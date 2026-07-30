import { itemTypeMeta } from "../../utils/bids";
import { ipfsGatewayUrl } from "../../lib/pinata";

export default function BidThumbnail({ itemType, previewUrl, ipfsHash, height = 140 }) {
  const meta = itemTypeMeta(itemType);
  const Icon = meta.icon;

  // previewUrl is an explicit override (e.g. the creating browser's freshly
  // uploaded gateway URL); any browser can otherwise reconstruct it purely
  // from the on-chain ipfsHash — no off-chain index required.
  const resolvedUrl = previewUrl || ipfsGatewayUrl(ipfsHash);
  const showsImage = resolvedUrl && itemType === "image";
  const showsVideo = resolvedUrl && itemType === "video";

  return (
    <div
      style={{
        height,
        borderRadius: 4,
        border: "1px solid var(--line)",
        overflow: "hidden",
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: showsImage || showsVideo
          ? "var(--canvas)"
          : "repeating-linear-gradient(135deg, var(--panel), var(--panel) 8px, var(--canvas) 8px, var(--canvas) 16px)",
      }}
    >
      {showsImage && (
        <img
          src={resolvedUrl}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      )}

      {showsVideo && (
        <video
          src={resolvedUrl}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          muted
        />
      )}

      {!showsImage && !showsVideo && (
        <Icon size={26} color="var(--ink-faint)" />
      )}

      <div
        className="label-micro"
        style={{
          position: "absolute",
          top: 8,
          left: 8,
          background: "var(--panel)",
          border: "1px solid var(--line)",
          borderRadius: 3,
          padding: "2px 6px",
          fontSize: 10,
        }}
      >
        {meta.label}
      </div>
    </div>
  );
}
