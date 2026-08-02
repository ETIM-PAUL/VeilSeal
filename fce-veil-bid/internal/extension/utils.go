package extension

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"veilbidding/internal/config"

	"github.com/flare-foundation/go-flare-common/pkg/logger"
	"github.com/flare-foundation/go-flare-common/pkg/tee/instruction"
	"github.com/flare-foundation/tee-node/pkg/processorutils"
	teetypes "github.com/flare-foundation/tee-node/pkg/types"
	teeutils "github.com/flare-foundation/tee-node/pkg/utils"
)

// --- In most cases, you will not need to modify this file. ---

func (e *Extension) actionHandler(w http.ResponseWriter, r *http.Request) {
	var action teetypes.Action
	err := json.NewDecoder(r.Body).Decode(&action)
	if err != nil {
		http.Error(w, fmt.Sprintf("decoding action: %v", err), http.StatusBadRequest)
		return
	}

	logger.Infof("received action, ID: %s", action.Data.ID)

	if df, async := bidDataFixed(action); async {
		go e.finishActionAsync(action)
		body, _ := json.Marshal(inProgressResult(action, df))
		logger.Infof("deferring action %s (REVEAL - may decrypt several sealed bids)", action.Data.ID)
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(body)
		return
	}

	status, body := e.processAction(action)

	logger.Infof("sending action result, ID: %s, status: %d, log: %s", action.Data.ID, status, getLogFromBody(body))

	w.WriteHeader(status)
	_, _ = w.Write(body)
}

// bidDataFixed returns parsed instruction data when the action is a BID/REVEAL
// or BID/SCORE - deferred asynchronously since both can involve multiple
// round trips (decrypting several sealed bids, or several chain RPC reads)
// that risk exceeding tee-node's 2s synchronous POST timeout.
func bidDataFixed(action teetypes.Action) (*instruction.DataFixed, bool) {
	df, err := processorutils.Parse[instruction.DataFixed](action.Data.Message)
	if err != nil {
		return nil, false
	}
	if df.OPType != teeutils.ToHash(config.OPTypeBid) {
		return nil, false
	}
	switch df.OPCommand {
	case teeutils.ToHash(config.OPCommandReveal),
		teeutils.ToHash(config.OPCommandScore),
		teeutils.ToHash(config.OPCommandMyScore),
		teeutils.ToHash(config.OPCommandStealthReveal):
		return df, true
	default:
		return df, false
	}
}

func inProgressResult(action teetypes.Action, df *instruction.DataFixed) teetypes.ActionResult {
	return teetypes.ActionResult{
		ID:            action.Data.ID,
		SubmissionTag: action.Data.SubmissionTag,
		Status:        2,
		Log:           "action in processing",
		OPType:        df.OPType,
		OPCommand:     df.OPCommand,
		Version:       config.Version,
	}
}

func (e *Extension) finishActionAsync(action teetypes.Action) {
	status, body := e.processAction(action)
	if status != http.StatusOK {
		logger.Errorf("async action %s failed: %s", action.Data.ID, string(body))
		return
	}
	var ar teetypes.ActionResult
	if err := json.Unmarshal(body, &ar); err != nil {
		logger.Errorf("async action %s: decode result: %v", action.Data.ID, err)
		return
	}
	if err := postActionResultToNode(e.signPort, ar); err != nil {
		logger.Errorf("async action %s: post result: %v", action.Data.ID, err)
		return
	}
	logger.Infof("async action %s posted to tee-node, status=%d", action.Data.ID, ar.Status)
}

func buildResult(a teetypes.Action, df *instruction.DataFixed, data []byte, status uint8, err error) teetypes.ActionResult {
	ar := teetypes.ActionResult{
		ID:            a.Data.ID,
		SubmissionTag: a.Data.SubmissionTag,
		Version:       config.Version,
		OPType:        df.OPType,
		OPCommand:     df.OPCommand,
		Data:          data,
		Status:        status,
	}
	switch status {
	case 0:
		ar.Log = fmt.Sprintf("error: %v", err)
	case 1:
		ar.Log = "ok"
	}
	return ar
}

func getLogFromBody(body []byte) string {
	var ar teetypes.ActionResult
	if err := json.Unmarshal(body, &ar); err != nil {
		return string(body)
	}
	return ar.Log
}

// --- TEE node /decrypt RPC ---

type decryptRequest struct {
	EncryptedMessage []byte `json:"encryptedMessage"`
}

type decryptResponse struct {
	DecryptedMessage []byte `json:"decryptedMessage"`
}

// postActionResultToNode delivers a completed ActionResult to the tee-node sign server,
// which signs it and forwards it to the extension proxy (async extension pattern).
func postActionResultToNode(signPort int, result teetypes.ActionResult) error {
	url := fmt.Sprintf("http://localhost:%d/result", signPort)
	body, err := json.Marshal(result)
	if err != nil {
		return fmt.Errorf("marshal: %w", err)
	}
	resp, err := http.DefaultClient.Post(url, "application/json", bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("post: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("node returned %d: %s", resp.StatusCode, string(b))
	}
	return nil
}

// decryptViaNode forwards ECIES ciphertext to the local tee-node /decrypt endpoint.
func decryptViaNode(signPort int, ciphertext []byte) ([]byte, error) {
	url := fmt.Sprintf("http://localhost:%d/decrypt", signPort)
	reqBody, _ := json.Marshal(decryptRequest{EncryptedMessage: ciphertext})

	resp, err := http.DefaultClient.Post(url, "application/json", bytes.NewReader(reqBody))
	if err != nil {
		return nil, fmt.Errorf("request error: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("node returned %d: %s", resp.StatusCode, string(b))
	}

	var dr decryptResponse
	if err := json.NewDecoder(resp.Body).Decode(&dr); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}
	return dr.DecryptedMessage, nil
}
