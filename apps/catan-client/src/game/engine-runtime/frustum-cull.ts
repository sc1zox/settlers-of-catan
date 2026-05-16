import { Frustum, Matrix4, Object3D, PerspectiveCamera, Sphere, Vector3 } from 'three';

export class FrustumCull {
  private readonly viewFrustum = new Frustum();
  private readonly viewProjectionMatrix = new Matrix4();
  private readonly cullCenter = new Vector3();
  private readonly cullSphere = new Sphere();

  public update(camera: PerspectiveCamera): void {
    camera.updateMatrixWorld();
    this.viewProjectionMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.viewFrustum.setFromProjectionMatrix(this.viewProjectionMatrix);
  }

  public intersectsObject(object: Object3D, radius: number): boolean {
    object.getWorldPosition(this.cullCenter);
    this.cullSphere.center.copy(this.cullCenter);
    this.cullSphere.radius = radius;
    return this.viewFrustum.intersectsSphere(this.cullSphere);
  }

  public intersectsOrigin(radius: number): boolean {
    this.cullSphere.center.set(0, 0, 0);
    this.cullSphere.radius = radius;
    return this.viewFrustum.intersectsSphere(this.cullSphere);
  }
}
