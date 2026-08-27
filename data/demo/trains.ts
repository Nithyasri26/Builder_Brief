import type { TrainOption } from '@/types/train';

/**
 * Sample journey options used to show the conversation flow. They are not
 * live railway availability and must never be presented as a real booking.
 */
export const demoTrainRoutes: Record<string, TrainOption[]> = {
  'bengaluru->chennai': [
    {
      id: 'train-12608',
      number: '12608',
      name: 'Lalbagh Express',
      from: 'Bengaluru',
      to: 'Chennai',
      departure: '06:10',
      arrival: '12:45',
      duration: '6h 35m',
      travelClass: 'Sleeper',
      fare: 345,
      availability: 'Seats available',
      runsOn: 'Daily',
    },
    {
      id: 'train-12610',
      number: '12610',
      name: 'Chennai Express',
      from: 'Bengaluru',
      to: 'Chennai',
      departure: '08:30',
      arrival: '15:20',
      duration: '6h 50m',
      travelClass: 'Sleeper',
      fare: 330,
      availability: 'Seats available',
      runsOn: 'Daily',
    },
    {
      id: 'train-12658',
      number: '12658',
      name: 'Bengaluru Mail',
      from: 'Bengaluru',
      to: 'Chennai',
      departure: '22:40',
      arrival: '04:35',
      duration: '5h 55m',
      travelClass: 'Sleeper',
      fare: 355,
      availability: 'Seats available',
      runsOn: 'Daily',
    },
  ],
  'bengaluru->mysuru': [
    {
      id: 'train-12614',
      number: '12614',
      name: 'Tippu Express',
      from: 'Bengaluru',
      to: 'Mysuru',
      departure: '15:00',
      arrival: '17:25',
      duration: '2h 25m',
      travelClass: 'Chair Car',
      fare: 175,
      availability: 'Seats available',
      runsOn: 'Daily',
    },
    {
      id: 'train-16022',
      number: '16022',
      name: 'Kaveri Express',
      from: 'Bengaluru',
      to: 'Mysuru',
      departure: '06:20',
      arrival: '09:10',
      duration: '2h 50m',
      travelClass: 'Sleeper',
      fare: 160,
      availability: 'Seats available',
      runsOn: 'Daily',
    },
  ],
};

/** Fallback journey options for any route not present in the demo dataset. */
export function buildGenericRoute(from: string, to: string): TrainOption[] {
  return [
    {
      id: 'train-demo-1',
      number: '10001',
      name: 'Intercity Express',
      from,
      to,
      departure: '07:15',
      arrival: '13:40',
      duration: '6h 25m',
      travelClass: 'Sleeper',
      fare: 320,
      availability: 'Seats available',
      runsOn: 'Daily',
    },
    {
      id: 'train-demo-2',
      number: '10002',
      name: 'Night Express',
      from,
      to,
      departure: '21:50',
      arrival: '05:05',
      duration: '7h 15m',
      travelClass: 'Sleeper',
      fare: 305,
      availability: 'Seats available',
      runsOn: 'Daily',
    },
  ];
}

export const RAIL_SOURCE = {
  name: 'IRCTC (official portal)',
  url: 'https://www.irctc.co.in',
  lastVerified: '2026-08-25',
} as const;
