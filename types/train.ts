export interface TrainOption {
  id: string;
  number: string;
  name: string;
  from: string;
  to: string;
  departure: string;
  arrival: string;
  duration: string;
  travelClass: string;
  fare: number;
  availability: string;
  runsOn: string;
}

export interface TrainSearch {
  id: string;
  userId: string;
  from: string;
  to: string;
  date: string;
  passengers: number;
  travelClass: string;
  createdAt: string;
  results: TrainOption[];
}
