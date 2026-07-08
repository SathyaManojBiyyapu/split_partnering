// Seed gym data per city for the gym selection page.
// Later, user-generated gyms will be stored in Firestore.

export interface GymData {
  id: string;
  name: string;
  city: string;
  verified: boolean;
  image?: string;
  waitingUsers: number;
}

// Seed gyms for initial cities
const seedGyms: GymData[] = [
  // Vijayawada
  { id: "vijayawada-golds", name: "Gold's Gym", city: "Vijayawada", verified: true, image: "/gym.webp", waitingUsers: 18 },
  { id: "vijayawada-anytime", name: "Anytime Fitness", city: "Vijayawada", verified: true, image: "/gym.webp", waitingUsers: 12 },
  { id: "vijayawada-new-golden", name: "New Golden Fitness", city: "Vijayawada", verified: true, image: "/gym.webp", waitingUsers: 6 },

  // Visakhapatnam
  { id: "visakhapatnam-golds", name: "Gold's Gym", city: "Visakhapatnam", verified: true, image: "/gym.webp", waitingUsers: 14 },
  { id: "visakhapatnam-abs", name: "ABS Fitness", city: "Visakhapatnam", verified: true, image: "/gym.webp", waitingUsers: 9 },
  { id: "visakhapatnam-varun", name: "Varun Fitness", city: "Visakhapatnam", verified: true, image: "/gym.webp", waitingUsers: 4 },

  // Hyderabad
  { id: "hyderabad-cult", name: "Cult.fit", city: "Hyderabad", verified: true, image: "/gym.webp", waitingUsers: 24 },
  { id: "hyderabad-golds", name: "Gold's Gym", city: "Hyderabad", verified: true, image: "/gym.webp", waitingUsers: 20 },
  { id: "hyderabad-anytime", name: "Anytime Fitness", city: "Hyderabad", verified: true, image: "/gym.webp", waitingUsers: 15 },

  // Bengaluru
  { id: "bengaluru-cult", name: "Cult.fit", city: "Bengaluru", verified: true, image: "/gym.webp", waitingUsers: 30 },
  { id: "bengaluru-golds", name: "Gold's Gym", city: "Bengaluru", verified: true, image: "/gym.webp", waitingUsers: 22 },
  { id: "bengaluru-anytime", name: "Anytime Fitness", city: "Bengaluru", verified: true, image: "/gym.webp", waitingUsers: 18 },

  // Chennai
  { id: "chennai-cult", name: "Cult.fit", city: "Chennai", verified: true, image: "/gym.webp", waitingUsers: 16 },
  { id: "chennai-golds", name: "Gold's Gym", city: "Chennai", verified: true, image: "/gym.webp", waitingUsers: 12 },
  { id: "chennai-anytime", name: "Anytime Fitness", city: "Chennai", verified: true, image: "/gym.webp", waitingUsers: 8 },

  // Mumbai
  { id: "mumbai-cult", name: "Cult.fit", city: "Mumbai", verified: true, image: "/gym.webp", waitingUsers: 28 },
  { id: "mumbai-golds", name: "Gold's Gym", city: "Mumbai", verified: true, image: "/gym.webp", waitingUsers: 25 },
  { id: "mumbai-anytime", name: "Anytime Fitness", city: "Mumbai", verified: true, image: "/gym.webp", waitingUsers: 14 },

  // Delhi
  { id: "delhi-cult", name: "Cult.fit", city: "Delhi", verified: true, image: "/gym.webp", waitingUsers: 20 },
  { id: "delhi-golds", name: "Gold's Gym", city: "Delhi", verified: true, image: "/gym.webp", waitingUsers: 16 },
  { id: "delhi-anytime", name: "Anytime Fitness", city: "Delhi", verified: true, image: "/gym.webp", waitingUsers: 10 },

  // Pune
  { id: "pune-cult", name: "Cult.fit", city: "Pune", verified: true, image: "/gym.webp", waitingUsers: 18 },
  { id: "pune-golds", name: "Gold's Gym", city: "Pune", verified: true, image: "/gym.webp", waitingUsers: 14 },
  { id: "pune-anytime", name: "Anytime Fitness", city: "Pune", verified: true, image: "/gym.webp", waitingUsers: 7 },

  // Kochi
  { id: "kochi-cult", name: "Cult.fit", city: "Kochi", verified: true, image: "/gym.webp", waitingUsers: 10 },
  { id: "kochi-golds", name: "Gold's Gym", city: "Kochi", verified: true, image: "/gym.webp", waitingUsers: 8 },
  { id: "kochi-anytime", name: "Anytime Fitness", city: "Kochi", verified: true, image: "/gym.webp", waitingUsers: 5 },

  // Kolkata
  { id: "kolkata-cult", name: "Cult.fit", city: "Kolkata", verified: true, image: "/gym.webp", waitingUsers: 12 },
  { id: "kolkata-golds", name: "Gold's Gym", city: "Kolkata", verified: true, image: "/gym.webp", waitingUsers: 10 },
  { id: "kolkata-anytime", name: "Anytime Fitness", city: "Kolkata", verified: true, image: "/gym.webp", waitingUsers: 6 },

  // Ahmedabad
  { id: "ahmedabad-cult", name: "Cult.fit", city: "Ahmedabad", verified: true, image: "/gym.webp", waitingUsers: 14 },
  { id: "ahmedabad-golds", name: "Gold's Gym", city: "Ahmedabad", verified: true, image: "/gym.webp", waitingUsers: 11 },
  { id: "ahmedabad-anytime", name: "Anytime Fitness", city: "Ahmedabad", verified: true, image: "/gym.webp", waitingUsers: 5 },

  // Jaipur
  { id: "jaipur-cult", name: "Cult.fit", city: "Jaipur", verified: true, image: "/gym.webp", waitingUsers: 8 },
  { id: "jaipur-golds", name: "Gold's Gym", city: "Jaipur", verified: true, image: "/gym.webp", waitingUsers: 6 },
  { id: "jaipur-anytime", name: "Anytime Fitness", city: "Jaipur", verified: true, image: "/gym.webp", waitingUsers: 3 },
];

// Build lookup: city → gyms[]
const gymsByCity: Record<string, GymData[]> = {};
seedGyms.forEach((gym) => {
  if (!gymsByCity[gym.city]) {
    gymsByCity[gym.city] = [];
  }
  gymsByCity[gym.city].push(gym);
});

// Also create reverse name-based lookup for "All" filter
const allGyms: GymData[] = seedGyms;

export function getGymsByCity(city: string): GymData[] {
  return gymsByCity[city] || [];
}

export function getAllGyms(): GymData[] {
  return allGyms;
}

export function getAvailableCities(): string[] {
  return Object.keys(gymsByCity).sort();
}

export function searchGyms(query: string, city?: string): GymData[] {
  const q = query.toLowerCase().trim();
  let source = city && city !== "All" ? getGymsByCity(city) : allGyms;
  if (!q) return source;
  return source.filter((gym) => gym.name.toLowerCase().includes(q));
}