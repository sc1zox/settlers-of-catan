import { SetMetadata } from '@nestjs/common';
import { RouteAccessMetadataKey } from '@catan/api-interfaces';

export const Public = () => SetMetadata(RouteAccessMetadataKey.IsPublic, true);
