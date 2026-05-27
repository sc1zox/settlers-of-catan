import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { WebcamQuality } from '@catan/api-interfaces';
import { APP_VERSION } from '../../../shared/app-version';
import { CloudDensity } from '../../../game/scene/cloud-density.enum';
import { RenderPixelRatio } from '../../../game/scene/render-pixel-ratio.enum';
import { ShadowQuality } from '../../../game/scene/shadow-quality.enum';
import { GameSettingsService } from './game-settings.service';
import { LobbyShellGameUiService } from '../lobby-game-ui/lobby-shell-game-ui.service';
import { LobbyLiveKitService } from '../webcam-head/lobby-livekit.service';

@Component({
  selector: 'app-game-settings-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  templateUrl: './game-settings-panel.html',
  styleUrl: './game-settings-panel.scss',
})
export class GameSettingsPanel {
  protected readonly settings = inject(GameSettingsService);
  protected readonly lobbyUi = inject(LobbyShellGameUiService);
  private readonly liveKit = inject(LobbyLiveKitService);
  protected readonly shadowQualityLow = ShadowQuality.Low;
  protected readonly shadowQualityMedium = ShadowQuality.Medium;
  protected readonly shadowQualityHigh = ShadowQuality.High;
  protected readonly renderPixelRatioLow = RenderPixelRatio.Low;
  protected readonly renderPixelRatioMedium = RenderPixelRatio.Medium;
  protected readonly renderPixelRatioHigh = RenderPixelRatio.High;
  protected readonly cloudDensityNone = CloudDensity.None;
  protected readonly cloudDensitySparse = CloudDensity.Sparse;
  protected readonly cloudDensityFull = CloudDensity.Full;
  protected readonly webcamQualityLow = WebcamQuality.Low;
  protected readonly webcamQualityMedium = WebcamQuality.Medium;
  protected readonly appVersion = APP_VERSION;

  public formatNumber(value: number, digits: number): string {
    return value.toFixed(digits);
  }

  public formatPercent(value: number): string {
    return `${Math.round(value * 100)} %`;
  }

  public onShadowQualityChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const value = select.value as ShadowQuality;
    this.settings.setShadowQuality(value);
  }

  public onRenderPixelRatioChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.settings.setRenderPixelRatio(select.value as RenderPixelRatio);
  }

  public onCloudDensityChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.settings.setCloudDensity(select.value as CloudDensity);
  }

  public onSunShaftsChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.settings.setSunShaftsEnabled(input.checked);
  }

  public onWaterAnimationChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.settings.setWaterAnimationEnabled(input.checked);
  }

  public onAmbientAnimationsChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.settings.setAmbientAnimationsEnabled(input.checked);
  }

  public onPerformanceOverlayChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.settings.setPerformanceOverlayEnabled(input.checked);
  }

  public onWebcamEnabledChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.settings.setWebcamEnabled(input.checked);
    if (input.checked) {
      if (typeof globalThis.isSecureContext === 'boolean' && globalThis.isSecureContext) {
        this.liveKit.beginLocalVideoCaptureFromUserGesture();
      }
    } else {
      void this.liveKit.abandonPrimedLocalVideoCapture();
    }
  }

  public onWebcamQualityChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.settings.setWebcamQuality(select.value as WebcamQuality);
  }

  public onSceneBrightnessChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.settings.setSceneBrightness(Number(input.value));
  }
}
