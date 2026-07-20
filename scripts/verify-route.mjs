const checkpoints = [
  [53.79633786619898, -2.687974626151308],
  [53.797347568037175, -2.6878622116685604],
  [53.798629694088056, -2.689792639658523],
  [53.79765665559433, -2.692083569227235],
  [53.79560518751338, -2.688040524247785],
  [53.79629207415533, -2.6867845831301898],
];

const R = 6_371_000;
const radians = (degrees) => (degrees * Math.PI) / 180;

function distance([lat1, lon1], [lat2, lon2]) {
  const dLat = radians(lat2 - lat1);
  const dLon = radians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(lat1)) *
      Math.cos(radians(lat2)) *
      Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

let total = 0;
for (let index = 0; index < checkpoints.length; index += 1) {
  const next = (index + 1) % checkpoints.length;
  const metres = distance(checkpoints[index], checkpoints[next]);
  total += metres;
  console.log(`Location ${index + 1} -> ${next + 1}: ${metres.toFixed(1)} m`);
}
console.log(`Straight-line circuit total: ${total.toFixed(1)} m`);
