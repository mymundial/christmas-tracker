export type Coordinate = {
  latitude: number;
  longitude: number;
};

const EARTH_RADIUS_METRES = 6_371_000;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
const toDegrees = (radians: number) => (radians * 180) / Math.PI;

export function distanceMetres(from: Coordinate, to: Coordinate): number {
  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const latitude1 = toRadians(from.latitude);
  const latitude2 = toRadians(to.latitude);

  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(latitude1) *
      Math.cos(latitude2) *
      Math.sin(longitudeDelta / 2) ** 2;

  return 2 * EARTH_RADIUS_METRES * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function bearingDegrees(from: Coordinate, to: Coordinate): number {
  const latitude1 = toRadians(from.latitude);
  const latitude2 = toRadians(to.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);

  const y = Math.sin(longitudeDelta) * Math.cos(latitude2);
  const x =
    Math.cos(latitude1) * Math.sin(latitude2) -
    Math.sin(latitude1) * Math.cos(latitude2) * Math.cos(longitudeDelta);

  return (toDegrees(Math.atan2(y, x)) + 360) % 360;
}

export function normalizeDegrees(value: number): number {
  return ((value % 360) + 360) % 360;
}
