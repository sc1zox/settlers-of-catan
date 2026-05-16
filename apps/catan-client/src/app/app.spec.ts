import { TestBed } from '@angular/core/testing';
import { TranslateLoader, type TranslationObject } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';
import de from '../assets/i18n/de.json';
import { App } from './app';
import { appConfig } from './app.config';

class DeJsonTranslateLoader implements TranslateLoader {
  public getTranslation(_lang: string): Observable<TranslationObject> {
    void _lang;
    return of(de as TranslationObject);
  }
}

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        ...appConfig.providers,
        { provide: TranslateLoader, useClass: DeJsonTranslateLoader },
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });
});
