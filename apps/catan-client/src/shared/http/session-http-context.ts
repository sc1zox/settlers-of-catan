import { HttpContextToken } from '@angular/common/http';

export const SESSION_AUTH_RETRY = new HttpContextToken<boolean>(() => false);
