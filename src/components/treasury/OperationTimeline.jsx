import { LuCheck, LuX } from "react-icons/lu";

const DEFAULT_STEPS = [
  "Wallet Signed",
  "Transaction Submitted",
  "Waiting for Relay",
  "Executing in TEE",
  "Attestation Verified",
  "Treasury Updated",
];

export default function OperationTimeline({ current = 2, failed = false, steps = DEFAULT_STEPS }) {
  return (
    <div className="panel" style={{ padding: "18px 20px" }}>
      <div className="label-micro-strong" style={{ marginBottom: 18 }}>
        Operation Timeline
      </div>

      {steps.map((step, index) => {
        const complete = index < current;
        const active = index === current;
        const isFailedStep = active && failed;
        const last = index === steps.length - 1;

        return (
          <div key={step} style={{ display: "flex", gap: 14 }}>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                width: 18,
              }}
            >
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 4,
                  flex: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: isFailedStep
                    ? "var(--danger-bg)"
                    : complete
                    ? "var(--signal)"
                    : active
                    ? "var(--signal-bg)"
                    : "transparent",
                  border: `1px solid ${
                    isFailedStep
                      ? "var(--danger)"
                      : complete || active
                      ? "var(--signal)"
                      : "var(--line-strong)"
                  }`,
                }}
              >
                {complete && <LuCheck size={12} color="var(--panel)" />}
                {isFailedStep && <LuX size={12} color="var(--danger)" />}
              </div>

              {!last && (
                <div
                  style={{
                    width: 1,
                    flex: 1,
                    minHeight: 20,
                    background: complete ? "var(--signal)" : "var(--line)",
                  }}
                />
              )}
            </div>

            <div style={{ paddingBottom: last ? 0 : 20 }}>
              <span
                style={{
                  fontSize: "0.875rem",
                  fontWeight: active ? 600 : 500,
                  color: isFailedStep
                    ? "var(--danger)"
                    : active || complete
                    ? "var(--ink)"
                    : "var(--ink-faint)",
                }}
              >
                {isFailedStep ? `${step} — Failed` : step}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
