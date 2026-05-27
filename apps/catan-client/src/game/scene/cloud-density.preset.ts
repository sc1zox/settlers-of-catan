import { CloudDensity } from './cloud-density.enum';

export function parseCloudDensity(raw: string | null): CloudDensity {
  if (raw === CloudDensity.None) {
    return CloudDensity.None;
  }
  if (raw === CloudDensity.Sparse) {
    return CloudDensity.Sparse;
  }
  return CloudDensity.Full;
}
