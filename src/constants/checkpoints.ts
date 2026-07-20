export type Checkpoint = {
  id: number;
  latitude: number;
  longitude: number;
  message: string;
};

export const CHECKPOINTS: Checkpoint[] = [
  {
    id: 1,
    latitude: 53.79633786619898,
    longitude: -2.687974626151308,
    message: "You've unlocked Location 1",
  },
  {
    id: 2,
    latitude: 53.797347568037175,
    longitude: -2.6878622116685604,
    message: "You've unlocked Location 2",
  },
  {
    id: 3,
    latitude: 53.798629694088056,
    longitude: -2.689792639658523,
    message: "You've unlocked Location 3",
  },
  {
    id: 4,
    latitude: 53.79765665559433,
    longitude: -2.692083569227235,
    message: "You've unlocked Location 4",
  },
  {
    id: 5,
    latitude: 53.79560518751338,
    longitude: -2.688040524247785,
    message: "You've unlocked Location 5",
  },
  {
    id: 6,
    latitude: 53.79629207415533,
    longitude: -2.6867845831301898,
    message: "You've unlocked Location 6",
  },
];

// Product rules. Keep these in one place so on-site tuning is quick.
export const REVEAL_RADIUS_METRES = 35;
export const UNLOCK_RADIUS_METRES = 10;
export const DWELL_TIME_MS = 2_000;
export const MAX_ACCEPTABLE_ACCURACY_METRES = 30;
export const PROGRESS_STORAGE_KEY = "christmas-tracker:next-checkpoint-index";
