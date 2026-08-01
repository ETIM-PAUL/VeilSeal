package agents

import (
	"encoding/json"
	"fmt"
	"math/big"
	"net/http"
	"strings"

	"github.com/ethereum/go-ethereum/crypto/ecies"
)

// teeInfoResponse mirrors the shape ext-proxy's GET /info already returns
// (see src/lib/tee/proxy.js's fetchTeeInfo doc comment) — the same endpoint
// the browser calls to ECIES-encrypt sealed bid terms client-side.
type teeInfoResponse struct {
	MachineData struct {
		PublicKey struct {
			X string `json:"x"`
			Y string `json:"y"`
		} `json:"publicKey"`
	} `json:"machineData"`
}

// fetchTeePublicKey reads the TEE's own published ECIES public key so the
// watcher can encrypt sealed bid terms exactly like a browser bidder would —
// only the public key is needed for encryption, nothing sensitive crosses
// this call.
func fetchTeePublicKey(proxyURL string) (*ecies.PublicKey, error) {
	if proxyURL == "" {
		return nil, fmt.Errorf("EXT_PROXY_URL not configured")
	}
	resp, err := http.Get(strings.TrimRight(proxyURL, "/") + "/info")
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("proxy /info returned %d", resp.StatusCode)
	}

	var info teeInfoResponse
	if err := json.NewDecoder(resp.Body).Decode(&info); err != nil {
		return nil, err
	}

	x, ok := new(big.Int).SetString(strings.TrimPrefix(info.MachineData.PublicKey.X, "0x"), 16)
	if !ok {
		return nil, fmt.Errorf("invalid TEE public key x")
	}
	y, ok := new(big.Int).SetString(strings.TrimPrefix(info.MachineData.PublicKey.Y, "0x"), 16)
	if !ok {
		return nil, fmt.Errorf("invalid TEE public key y")
	}

	return &ecies.PublicKey{X: x, Y: y, Curve: ecies.DefaultCurve, Params: ecies.ECIES_AES128_SHA256}, nil
}
