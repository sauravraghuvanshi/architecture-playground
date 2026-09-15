"use client";

import type { ArchPayload } from "../modes/architecture/ArchitectureCanvas";
import { AzureDeployModal } from "./AzureDeployModal";

interface Props {
  open: boolean;
  payload: ArchPayload;
  onClose: () => void;
}

export function ArchitectureCodeModal(props: Props) {
  return <AzureDeployModal {...props} intent="code" />;
}
