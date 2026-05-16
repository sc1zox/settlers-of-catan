import { BuildKind } from '@catan/api-interfaces';

export function legalIdsForKind(
  kind: BuildKind,
  legalSettlementVertexIds: readonly string[],
  legalRoadEdgeIds: readonly string[],
  legalCityVertexIds: readonly string[],
  legalRoadBuildingEdgeIds: readonly string[],
  buildModeFreeRoad: boolean,
): readonly string[] {
  if (kind === BuildKind.Settlement) {
    return legalSettlementVertexIds;
  }
  if (kind === BuildKind.Road) {
    return buildModeFreeRoad ? legalRoadBuildingEdgeIds : legalRoadEdgeIds;
  }
  return legalCityVertexIds;
}
