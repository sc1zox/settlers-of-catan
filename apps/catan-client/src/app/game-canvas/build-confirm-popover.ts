import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { marker } from '@colsen1991/ngx-translate-extract-marker';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { BuildKind } from '@catan/api-interfaces';
import { EnumTranslate } from '../../game/i18n/enum-translate.helper';

export interface BuildConfirmModel {
  readonly kind: BuildKind;
  readonly id: string;
  readonly x: number;
  readonly y: number;
}

@Component({
  selector: 'app-build-confirm-popover',
  standalone: true,
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './build-confirm-popover.html',
  styleUrl: './build-confirm-popover.scss',
})
export class BuildConfirmPopover {
  private readonly translate = inject(TranslateService);
  readonly model = input<BuildConfirmModel | null>(null);
  readonly confirm = output<void>();
  readonly dismiss = output<void>();

  protected titleFor(kind: BuildKind): string {
    return EnumTranslate.translateBuildKindConfirm(
      (key, params) => this.translate.instant(marker(key), params),
      kind,
    );
  }
}
