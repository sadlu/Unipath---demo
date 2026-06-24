import type { LocalEvent } from '../types'

const KATHMANDU_CENTER = { lat: 27.7172, lng: 85.3240 }

const MOCK_EVENTS: LocalEvent[] = [
  {
    id: '1',
    title: 'AI Workshop: Machine Learning Basics',
    description: 'A hands-on workshop covering ML fundamentals, TensorFlow, and real-world applications. Hosted by Kathmandu University CS department.',
    date: '2026-07-15T10:00:00+05:45',
    venue: 'Kathmandu University, Dhulikhel',
    source: 'Facebook',
    sourceUrl: 'https://facebook.com/events/ku-ai-workshop',
    coordinates: { lat: 27.6201, lng: 85.5384 },
  },
  {
    id: '2',
    title: 'Nepal Hackathon 2026',
    description: '48-hour hackathon focused on EdTech solutions for rural Nepal. Teams of 3-5. Prizes worth NPR 5 Lakhs.',
    date: '2026-08-20T08:00:00+05:45',
    venue: 'Innovation Hub, Kamalpokhari, Kathmandu',
    source: 'Reddit',
    sourceUrl: 'https://reddit.com/r/Nepal/comments/nepal-hackathon',
    coordinates: { lat: 27.7155, lng: 85.3227 },
  },
  {
    id: '3',
    title: 'Startup Weekend Kathmandu',
    description: 'Pitch your startup idea, form a team, and build a prototype in 54 hours. Mentors from leading Nepali startups.',
    date: '2026-09-05T09:00:00+05:45',
    venue: 'Naxal Hall, Kathmandu',
    source: 'Events Nepal',
    sourceUrl: 'https://eventsnepal.com/startup-weekend-ktm',
    coordinates: { lat: 27.7145, lng: 85.3278 },
  },
  {
    id: '4',
    title: 'Robotics Exhibition 2026',
    description: 'Annual robotics showcase featuring student projects from Pulchowk, KU, and IOE. Live demos and competitions.',
    date: '2026-07-28T10:00:00+05:45',
    venue: 'Pulchowk Engineering Campus, Lalitpur',
    source: 'Kathmandu Post',
    sourceUrl: 'https://kathmandupost.com/events/robotics-2026',
    coordinates: { lat: 27.6779, lng: 85.3181 },
  },
  {
    id: '5',
    title: 'Digital Marketing Bootcamp',
    description: 'Two-week intensive bootcamp on SEO, social media marketing, and Google Ads. Certificates provided.',
    date: '2026-08-10T09:00:00+05:45',
    venue: 'Baneshwor, Kathmandu',
    source: 'Facebook',
    sourceUrl: 'https://facebook.com/events/digital-marketing-bootcamp',
    coordinates: { lat: 27.7031, lng: 85.3408 },
  },
  {
    id: '6',
    title: 'Climate Action Summit: Youth Edition',
    description: 'Youth-led climate action planning summit. Workshops on sustainable agriculture, waste management, and renewable energy.',
    date: '2026-09-12T08:00:00+05:45',
    venue: 'Hotel Yak & Yeti, Kathmandu',
    source: 'E-Kantipur',
    sourceUrl: 'https://happening.ekantipur.com/climate-summit',
    coordinates: { lat: 27.7152, lng: 85.3196 },
  },
  {
    id: '7',
    title: 'React & TypeScript Coding Workshop',
    description: 'Free community workshop on building modern web apps with React 19 and TypeScript. Bring your laptop.',
    date: '2026-07-22T11:00:00+05:45',
    venue: 'Leapfrog Academy, Putalisadak, Kathmandu',
    source: 'Reddit',
    sourceUrl: 'https://reddit.com/r/developersNepal/comments/react-workshop',
    coordinates: { lat: 27.7082, lng: 85.3256 },
  },
  {
    id: '8',
    title: 'Nepal Tourism Expo 2026',
    description: 'Showcasing adventure tourism, homestays, and cultural heritage. Networking with tour operators and hospitality brands.',
    date: '2026-10-05T09:00:00+05:45',
    venue: 'Bhrikutimandap Exhibition Hall, Kathmandu',
    source: 'Tourism Board',
    sourceUrl: 'https://nepaltourismboard.com/expo-2026',
    coordinates: { lat: 27.6983, lng: 85.3189 },
  },
  {
    id: '9',
    title: 'Flutter Developer Meetup #4',
    description: 'Monthly Flutter meetup. This session: Riverpod vs BLoC, and building responsive UIs. Snacks provided.',
    date: '2026-07-30T15:00:00+05:45',
    venue: 'CloudFactory, Satdobato, Lalitpur',
    source: 'Facebook',
    sourceUrl: 'https://facebook.com/events/flutter-meetup-4',
    coordinates: { lat: 27.6553, lng: 85.3263 },
  },
  {
    id: '10',
    title: 'Women in Tech Conference',
    description: 'Annual conference celebrating women in technology. Keynotes, panel discussions, and networking. Free entry for students.',
    date: '2026-08-15T09:00:00+05:45',
    venue: 'US Embassy, Maharajgunj, Kathmandu',
    source: 'Events Nepal',
    sourceUrl: 'https://eventsnepal.com/women-in-tech-2026',
    coordinates: { lat: 27.7261, lng: 85.3183 },
  },
]

function isInKathmanduValley(lat: number, lng: number): boolean {
  const dlat = lat - KATHMANDU_CENTER.lat
  const dlng = lng - KATHMANDU_CENTER.lng
  const dist = Math.sqrt(dlat * dlat + dlng * dlng)
  return dist < 0.4
}

function extractDate(dateStr: string): Date {
  const d = new Date(dateStr)
  return isNaN(d.getTime()) ? new Date() : d
}

export async function searchLocalEvents(
  query: string,
  options?: { lat?: number; lng?: number; radiusKm?: number }
): Promise<LocalEvent[]> {
  const lat = options?.lat ?? KATHMANDU_CENTER.lat
  const lng = options?.lng ?? KATHMANDU_CENTER.lng
  const radiusKm = options?.radiusKm ?? 30

  await new Promise((r) => setTimeout(r, 400 + Math.random() * 300))

  if (!query.trim()) {
    return MOCK_EVENTS
      .filter((e) => isInKathmanduValley(e.coordinates.lat, e.coordinates.lng))
      .sort((a, b) => extractDate(a.date).getTime() - extractDate(b.date).getTime())
  }

  const q = query.toLowerCase()
  const keywords = q.split(/\s+/)

  const scored = MOCK_EVENTS
    .filter((e) => isInKathmanduValley(e.coordinates.lat, e.coordinates.lng))
    .map((event) => {
      let score = 0
      const searchText = (event.title + ' ' + event.description + ' ' + event.venue + ' ' + event.source).toLowerCase()
      for (const kw of keywords) {
        if (kw.length < 2) continue
        if (searchText.includes(kw)) score += 1
        if (event.title.toLowerCase().includes(kw)) score += 2
      }
      return { event, score }
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || extractDate(a.event.date).getTime() - extractDate(b.event.date).getTime())
    .map(({ event }) => event)

  return scored
}
