const ASSET_BASE =
  'https://assets.macaly-user-data.dev/mw0052ef1ats3fdze8oc8cv3/soipdph9iwfnpx3yujjal240'

export const IMAGES = {
  tower: `${ASSET_BASE}/JMeJrxLrKW7279S35av4v/generated-BfRXzSDM.png`,
  living: `${ASSET_BASE}/w45vgtB_B-a0qImPtJQEs/generated-FhfE0PcM.png`,
  villas: `${ASSET_BASE}/M9UMswX-_BR2KH6YhzUTj/generated-iMjSJxyD.png`,
  pool: `${ASSET_BASE}/aBQZYtAC7LNCJ82OYAuCY/generated-a174N20B.png`,
  lowrise: `${ASSET_BASE}/RnlFcPO1iCTqfS-jD-ZDM/generated-GQkj-hSz.png`,
  detail: `${ASSET_BASE}/QjHGss4QEmWxcFbFaZW0K/generated-ovy1vWPy.png`,
  bath: `${ASSET_BASE}/ScGsXGiTVl6UBj8mjPbtn/generated-tmWF41yL.png`,
  rooftop: `${ASSET_BASE}/6Z42vz-UssOJcx_7dN8Jm/generated-p9L_voV6.png`,
  penthouse: `${ASSET_BASE}/ReBKaOGjelSc20sygsg3m/generated-vaRD7kPU.png`,
  beachVilla: `${ASSET_BASE}/RR9IZPYEIGPTLcGyEfQk1/generated-97IMcvF6.png`,
  bedroom: `${ASSET_BASE}/QRsyxITttJ-3R5fgwL1yY/generated-_eptRDO1.png`,
  marinaNight: `${ASSET_BASE}/aTJXxOxLZyptD3fmsJg6Q/generated-GtNdy60c.png`,
  courtyard: `${ASSET_BASE}/hty4AVGY2YqbPcYWRCeNs/generated-nt_nTw8n.png`,
  kitchen: `${ASSET_BASE}/N0BCtMjsaBvI1RsA-f_L-/generated-nyYGXGOW.png`,
}

export const RESIDENCE_PATHS = {
  'palm-jumeirah': '/residences/palm-jumeirah',
  downtown: '/residences/downtown',
  marina: '/residences/marina',
  'al-barari': '/residences/al-barari',
  'jbr': '/residences/jbr',
  'emirates-hills': '/residences/emirates-hills',
  'business-bay': '/residences/business-bay',
  'jumeirah-golf': '/residences/jumeirah-golf',
  'city-walk': '/residences/city-walk',
  'difc': '/residences/difc',
  'bluewaters': '/residences/bluewaters',
  'al-wasl': '/residences/al-wasl',
  'dubai-hills': '/residences/dubai-hills',
  'jumeirah-bay': '/residences/jumeirah-bay',
  'tilal-al-ghaf': '/residences/tilal-al-ghaf',
  'mudon': '/residences/mudon',
  'arabian-ranches': '/residences/arabian-ranches',
  'the-valley': '/residences/the-valley',
  'jumeirah-islands': '/residences/jumeirah-islands',
  'creek-harbour': '/residences/creek-harbour',
  jvc: '/residences/jvc',
} as const

export type ResidenceSlug = keyof typeof RESIDENCE_PATHS

export type Room = { x: number; y: number; w: number; h: number; label: string; tone?: 'living' | 'wet' | 'terrace' }

export type FloorPlan = {
  id: string
  name: string
  bedrooms: string
  size: string
  width: number
  height: number
  rooms: Room[]
}

export type GalleryShot = { src: string; caption: string }

export type ResidenceInvestment = {
  entryFrom: string
  yieldPct: string
  options: { name: string; detail: string }[]
  note: string
}

export type Residence = {
  slug: ResidenceSlug
  name: string
  area: string
  configuration: string
  price: string
  image: string
  alt: string
  summary: string
  description: string
  bedrooms: string
  size: string
  handover: string
  features: string[]
  gallery: GalleryShot[]
  plans: FloorPlan[]
  investment: ResidenceInvestment
}

export const RESIDENCES: Residence[] = [
  {
    slug: 'palm-jumeirah',
    name: 'Msheireb Palm Crest',
    area: 'Palm Jumeirah, Dubai',
    configuration: '4 & 5 bedroom penthouses',
    price: 'Price on request',
    image: IMAGES.villas,
    alt: 'Private beachfront villas with infinity pools and palm groves at dusk',
    summary: 'Eighteen beachfront homes, each with a private terrace facing the Arabian Gulf.',
    description:
      'Set on the crescent of Palm Jumeirah, Palm Crest is a collection of eighteen beachfront homes. Every residence opens onto a private terrace and infinity pool, with the Dubai skyline held across the water. Interiors are finished in travertine, walnut and brushed brass.',
    bedrooms: '4 & 5 bedrooms',
    size: '6,400 to 9,100 sq. ft.',
    handover: 'To be confirmed',
    features: [
      'Private beach access and infinity pool',
      'Skyline views across the Arabian Gulf',
      'Private lift lobby to every home',
      'Two covered parking bays with valet',
      'Resident concierge and in-home dining',
    ],
    gallery: [
      { src: IMAGES.villas, caption: 'Beachfront homes at dusk' },
      { src: IMAGES.living, caption: 'Living room, golden hour' },
      { src: IMAGES.pool, caption: 'The lap pool colonnade' },
      { src: IMAGES.detail, caption: 'Travertine and bronze detail' },
      { src: IMAGES.tower, caption: 'The tower from the water' },
    ],
    plans: [
      {
        id: 'palm-4',
        name: 'Type A · Ground villa',
        bedrooms: '4 bedrooms',
        size: '6,400 sq. ft.',
        width: 100,
        height: 64,
        rooms: [
          { x: 0, y: 0, w: 100, h: 12, label: 'Private terrace & pool', tone: 'terrace' },
          { x: 0, y: 12, w: 40, h: 22, label: 'Living room', tone: 'living' },
          { x: 40, y: 12, w: 22, h: 14, label: 'Dining' },
          { x: 62, y: 12, w: 20, h: 14, label: 'Kitchen' },
          { x: 82, y: 12, w: 18, h: 14, label: 'Maid’s room' },
          { x: 0, y: 34, w: 30, h: 18, label: 'Master suite' },
          { x: 30, y: 34, w: 24, h: 18, label: 'Bedroom 2' },
          { x: 54, y: 34, w: 22, h: 18, label: 'Bedroom 3' },
          { x: 76, y: 34, w: 24, h: 18, label: 'Bedroom 4' },
          { x: 0, y: 52, w: 20, h: 12, label: 'Family bath', tone: 'wet' },
          { x: 20, y: 52, w: 16, h: 12, label: 'Powder', tone: 'wet' },
          { x: 36, y: 52, w: 64, h: 12, label: 'Gallery & stair' },
        ],
      },
      {
        id: 'palm-5',
        name: 'Type B · Sky penthouse',
        bedrooms: '5 bedrooms',
        size: '9,100 sq. ft.',
        width: 100,
        height: 64,
        rooms: [
          { x: 0, y: 0, w: 100, h: 14, label: 'Sky terrace', tone: 'terrace' },
          { x: 0, y: 14, w: 44, h: 24, label: 'Living room', tone: 'living' },
          { x: 44, y: 14, w: 20, h: 12, label: 'Dining' },
          { x: 64, y: 14, w: 20, h: 12, label: 'Kitchen' },
          { x: 84, y: 14, w: 16, h: 12, label: 'Pantry' },
          { x: 0, y: 38, w: 32, h: 16, label: 'Master suite' },
          { x: 32, y: 38, w: 22, h: 16, label: 'Bedroom 2' },
          { x: 54, y: 38, w: 22, h: 16, label: 'Bedroom 3' },
          { x: 76, y: 38, w: 24, h: 16, label: 'Bedroom 4' },
          { x: 0, y: 54, w: 24, h: 10, label: 'Bedroom 5' },
          { x: 24, y: 54, w: 24, h: 10, label: 'Baths', tone: 'wet' },
          { x: 48, y: 54, w: 52, h: 10, label: 'Lift lobby' },
        ],
      },
    ],
    investment: {
      entryFrom: 'Price on request',
      yieldPct: 'Not provided',
      options: [
        { name: '30 / 70 plan', detail: '30% on booking, 70% on handover in Q4 2027.' },
        { name: 'Post-handover 3 years', detail: '40% during construction, 60% over 36 months after handover.' },
        { name: 'Cash purchase', detail: 'Full payment on booking with a 4% discount on the list price.' },
      ],
      note: 'Illustrative preview only. No verified price, rental yield, service charge, payment plan or investment return is represented. Confirm all details before publication.',
    },
  },
  {
    slug: 'downtown',
    name: 'Msheireb Downtown',
    area: 'Downtown Dubai',
    configuration: '2 & 3 bedroom residences',
    price: 'Price on request',
    image: IMAGES.lowrise,
    alt: 'Low-rise limestone and bronze residence with planted balconies and a water court',
    summary: 'A low-rise address of thirty-two homes around a shaded water court.',
    description:
      'A quiet, low-rise address minutes from Burj Khalifa. Thirty-two homes wrap around a shaded water court, with planted balconies and deep window reveals that hold the desert light. The building is designed for residents who want the city at walking distance, not in the living room.',
    bedrooms: '2 & 3 bedrooms',
    size: '1,850 to 2,900 sq. ft.',
    handover: 'To be confirmed',
    features: [
      'Walk to Burj Khalifa and Dubai Mall',
      'Shaded water court and garden decks',
      'Residents’ lounge and co-working room',
      'Kids’ studio and play terrace',
      'Two basement parking levels with EV charging',
    ],
    gallery: [
      { src: IMAGES.lowrise, caption: 'Limestone facade and planted balconies' },
      { src: IMAGES.detail, caption: 'Bronze fins, travertine wall' },
      { src: IMAGES.living, caption: 'Living room at golden hour' },
      { src: IMAGES.pool, caption: 'The shaded water court' },
    ],
    plans: [
      {        id: 'downtown-2',
        name: 'Type A · 2 bedroom',
        bedrooms: '2 bedrooms',
        size: '1,850 sq. ft.',
        width: 100,
        height: 56,
        rooms: [
          { x: 0, y: 0, w: 100, h: 8, label: 'Balcony', tone: 'terrace' },
          { x: 0, y: 8, w: 42, h: 26, label: 'Living & dining', tone: 'living' },
          { x: 42, y: 8, w: 20, h: 14, label: 'Kitchen' },
          { x: 62, y: 8, w: 18, h: 14, label: 'Utility', tone: 'wet' },
          { x: 80, y: 8, w: 20, h: 14, label: 'Entry' },
          { x: 0, y: 34, w: 30, h: 22, label: 'Master suite' },
          { x: 30, y: 34, w: 26, h: 22, label: 'Bedroom 2' },
          { x: 56, y: 34, w: 20, h: 22, label: 'Baths', tone: 'wet' },
          { x: 76, y: 34, w: 24, h: 22, label: 'Study' },
        ],
      },
      {
        id: 'downtown-3',
        name: 'Type B · 3 bedroom',
        bedrooms: '3 bedrooms',
        size: '2,900 sq. ft.',
        width: 100,
        height: 60,
        rooms: [
          { x: 0, y: 0, w: 100, h: 8, label: 'Balcony', tone: 'terrace' },
          { x: 0, y: 8, w: 40, h: 26, label: 'Living room', tone: 'living' },
          { x: 40, y: 8, w: 22, h: 14, label: 'Dining' },
          { x: 62, y: 8, w: 20, h: 14, label: 'Kitchen' },
          { x: 82, y: 8, w: 18, h: 14, label: 'Maid’s room' },
          { x: 0, y: 34, w: 28, h: 26, label: 'Master suite' },
          { x: 28, y: 34, w: 22, h: 26, label: 'Bedroom 2' },
          { x: 50, y: 34, w: 22, h: 26, label: 'Bedroom 3' },
          { x: 72, y: 34, w: 16, h: 26, label: 'Baths', tone: 'wet' },
          { x: 88, y: 34, w: 12, h: 26, label: 'Corridor' },
        ],
      },
    ],
    investment: {
      entryFrom: 'Price on request',
      yieldPct: 'Not provided',
      options: [
        { name: '20 / 80 plan', detail: '20% on booking, 80% on transfer. Ready to move.' },
        { name: 'Mortgage assisted', detail: 'Introductions to three UAE lenders, up to 75% loan to value.' },
        { name: 'Furnished leaseback', detail: 'Two year leaseback at 6.4% net with the operator.' },
      ],
      note: 'Illustrative preview only. No verified price, rental yield, service charge, payment plan or investment return is represented. Confirm all details before publication.',
    },
  },
  {
    slug: 'marina',
    name: 'Msheireb Marina',
    area: 'Dubai Marina',
    configuration: '3 & 4 bedroom residences',
    price: 'Price on request',
    image: IMAGES.living,
    alt: 'Warm contemporary living room with floor to ceiling windows over the water',
    summary: 'Interiors finished in travertine, walnut and brushed brass, above the marina.',
    description:
      'A tower of ninety homes above Dubai Marina, with living rooms turned toward the water. The club floor sits at level forty: lap pool, hammam, and a residents’ terrace that catches the evening breeze off the Gulf.',
    bedrooms: '3 & 4 bedrooms',
    size: '2,600 to 4,200 sq. ft.',
    handover: 'To be confirmed',
    features: [
      'Marina and sea-facing living rooms',
      'Level-40 club floor with lap pool',
      'Hammam, spa and treatment suites',
      'Private screening room',
      'Marina berth allocation on request',
    ],
    gallery: [
      { src: IMAGES.living, caption: 'Living room facing the marina' },
      { src: IMAGES.pool, caption: 'Level-40 club pool' },
      { src: IMAGES.tower, caption: 'The tower at dusk' },
      { src: IMAGES.detail, caption: 'Brass and travertine joinery' },
      { src: IMAGES.villas, caption: 'Marina berths below the tower' },
    ],
    plans: [
      {
        id: 'marina-3',
        name: 'Type A · 3 bedroom',
        bedrooms: '3 bedrooms',
        size: '2,600 sq. ft.',
        width: 100,
        height: 58,
        rooms: [
          { x: 0, y: 0, w: 100, h: 9, label: 'Marina balcony', tone: 'terrace' },
          { x: 0, y: 9, w: 42, h: 25, label: 'Living room', tone: 'living' },
          { x: 42, y: 9, w: 20, h: 13, label: 'Dining' },
          { x: 62, y: 9, w: 22, h: 13, label: 'Kitchen' },
          { x: 84, y: 9, w: 16, h: 13, label: 'Utility', tone: 'wet' },
          { x: 0, y: 34, w: 30, h: 24, label: 'Master suite' },
          { x: 30, y: 34, w: 22, h: 24, label: 'Bedroom 2' },
          { x: 52, y: 34, w: 22, h: 24, label: 'Bedroom 3' },
          { x: 74, y: 34, w: 14, h: 24, label: 'Baths', tone: 'wet' },
          { x: 88, y: 34, w: 12, h: 24, label: 'Foyer' },
        ],
      },
      {
        id: 'marina-4',
        name: 'Type B · 4 bedroom',
        bedrooms: '4 bedrooms',
        size: '4,200 sq. ft.',
        width: 100,
        height: 62,
        rooms: [
          { x: 0, y: 0, w: 100, h: 9, label: 'Corner terrace', tone: 'terrace' },
          { x: 0, y: 9, w: 40, h: 24, label: 'Living room', tone: 'living' },
          { x: 40, y: 9, w: 22, h: 12, label: 'Dining' },
          { x: 62, y: 9, w: 20, h: 12, label: 'Kitchen' },
          { x: 82, y: 9, w: 18, h: 12, label: 'Maid’s room' },
          { x: 0, y: 33, w: 26, h: 18, label: 'Master suite' },
          { x: 26, y: 33, w: 20, h: 18, label: 'Bedroom 2' },
          { x: 46, y: 33, w: 20, h: 18, label: 'Bedroom 3' },
          { x: 66, y: 33, w: 20, h: 18, label: 'Bedroom 4' },
          { x: 86, y: 33, w: 14, h: 18, label: 'Baths', tone: 'wet' },
          { x: 0, y: 51, w: 50, h: 11, label: 'Foyer & lift' },
          { x: 50, y: 51, w: 50, h: 11, label: 'Store & laundry', tone: 'wet' },
        ],
      },
    ],
    investment: {
      entryFrom: 'Price on request',
      yieldPct: 'Not provided',
      options: [
        { name: '30 / 70 plan', detail: '30% on booking, 70% on handover in Q2 2027.' },
        { name: '40 / 60 post-handover', detail: '40% during construction, 60% over 24 months after handover.' },
        { name: 'Marina berth bundle', detail: 'Residence plus 12 metre berth, priced on application.' },
      ],
      note: 'Illustrative preview only. No verified price, rental yield, service charge, payment plan or investment return is represented. Confirm all details before publication.',
    },
  },
]

export const AMENITIES = [
  { index: '01', title: 'Wellness spaces', detail: 'Illustrative amenity category — actual facilities to be confirmed.' },
  { index: '02', title: 'Resident services', detail: 'Illustrative amenity category — actual services to be confirmed.' },
  { index: '03', title: 'Fitness facilities', detail: 'Illustrative amenity category — actual facilities to be confirmed.' },
  { index: '04', title: 'Outdoor spaces', detail: 'Illustrative amenity category — actual facilities to be confirmed.' },
  { index: '05', title: 'Shared lounges', detail: 'Illustrative amenity category — actual facilities to be confirmed.' },
  { index: '06', title: 'Parking', detail: 'Illustrative amenity category — actual arrangements to be confirmed.' },
]

export const SITE = {
  name: 'Msheireb Properties',
  tagline: 'Redefining urban living',
  city: 'Dubai',
  country: 'United Arab Emirates',
  address: ['Dubai, United Arab Emirates', 'Sales address to be confirmed'],
  hours: 'Appointment details to be confirmed',
  phone: '',
}

const PHOTOS = {
  'al-barari': 'https://images.pexels.com/photos/4870581/pexels-photo-4870581.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=1100&w=1600',
  'jbr': 'https://images.pexels.com/photos/36806778/pexels-photo-36806778.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=1100&w=1600',
  'emirates-hills': 'https://images.pexels.com/photos/1131871/pexels-photo-1131871.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=1100&w=1600',
  'business-bay': 'https://images.pexels.com/photos/19335818/pexels-photo-19335818.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=1100&w=1600',
  'jumeirah-golf': 'https://images.pexels.com/photos/27309420/pexels-photo-27309420.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=1100&w=1600',
  'city-walk': 'https://images.pexels.com/photos/33140403/pexels-photo-33140403.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=1100&w=1600',
  'difc': 'https://images.pexels.com/photos/21901580/pexels-photo-21901580.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=1100&w=1600',
  'bluewaters': 'https://images.pexels.com/photos/39633670/pexels-photo-39633670.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=1100&w=1600',
  'al-wasl': 'https://images.pexels.com/photos/29560257/pexels-photo-29560257.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=1100&w=1600',
  'dubai-hills': 'https://images.pexels.com/photos/33709939/pexels-photo-33709939.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=1100&w=1600',
  'jumeirah-bay': 'https://images.pexels.com/photos/28054849/pexels-photo-28054849.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=1100&w=1600',
  'tilal-al-ghaf': 'https://images.pexels.com/photos/8356061/pexels-photo-8356061.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=1100&w=1600',
  'mudon': 'https://images.pexels.com/photos/28403269/pexels-photo-28403269.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=1100&w=1600',
  'arabian-ranches': 'https://images.pexels.com/photos/8143683/pexels-photo-8143683.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=1100&w=1600',
  'the-valley': 'https://images.pexels.com/photos/16849001/pexels-photo-16849001.png?auto=compress&cs=tinysrgb&dpr=2&h=1100&w=1600',
  'jumeirah-islands': 'https://images.pexels.com/photos/19075389/pexels-photo-19075389.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=1100&w=1600',
  'creek-harbour': 'https://images.pexels.com/photos/713458/pexels-photo-713458.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=1100&w=1600',
} as const

type ListingSeed = {
  slug: string
  name: string
  area: string
  configuration: string
  price: string
  image: string
  alt: string
  summary: string
  description: string
  bedrooms: string
  size: string
  handover: string
  entryFrom: string
  yieldPct: string
  features: string[]
}

const LISTING_SEEDS: ListingSeed[] = [
  {
    slug: 'al-barari',
    name: 'Msheireb Al Barari Garden Homes',
    area: 'Al Barari, Dubai',
    configuration: '4 & 5 bedroom garden villas',
    price: 'Price on request',
    image: PHOTOS['al-barari'],    alt: 'A tranquil tropical villa with a swimming pool surrounded by lush palm trees',
    summary: 'Low villas set inside mature gardens, each with a shaded courtyard pool.',
    description:
      'Twelve garden homes arranged around a private water garden in Al Barari. Every villa opens to a shaded courtyard, with mature planting screening the pool terrace from the neighbouring plots.',
    bedrooms: '4 & 5 bedrooms',
    size: '5,200 to 7,400 sq. ft.',
    handover: 'To be confirmed',
    entryFrom: 'Price on request',
    yieldPct: 'Not provided',
    features: ['Private courtyard pool', 'Mature landscaped gardens', 'Garden suite with kitchenette', 'Two covered bays and a golf cart bay', 'Resident gardener and pool care'],
  },
  {
    slug: 'jbr',
    name: 'Msheireb Jumeirah Beach Residence',
    area: 'JBR, Dubai Marina',
    configuration: '2 & 3 bedroom sea-view apartments',
    price: 'Price on request',
    image: PHOTOS['jbr'],
    alt: 'A modern apartment building by the sea in Torrevieja, Spain, under clear skies',
    summary: 'Sea-facing apartments a short walk from the beach and the promenade.',
    description:
      'A beachfront address on Jumeirah Beach Residence with living rooms turned to the sea. The building has a shaded pool deck on level five and direct access to the promenade.',
    bedrooms: '2 & 3 bedrooms',
    size: '1,450 to 2,350 sq. ft.',
    handover: 'To be confirmed',
    entryFrom: 'Price on request',
    yieldPct: 'Not provided',
    features: ['Direct beach access', 'Shaded pool deck', 'Sea-facing living rooms', 'Two parking bays', 'Short-let permitted with licence'],
  },
  {
    slug: 'emirates-hills',
    name: 'Msheireb Emirates Hills Estate',
    area: 'Emirates Hills, Dubai',
    configuration: '5 to 7 bedroom mansions',
    price: 'Price on request',
    image: PHOTOS['emirates-hills'],
    alt: 'Aerial shot of a luxurious estate with pool and garden in Serpong, Indonesia',
    summary: 'Six estate plots on the Montgomerie with lake and golf views.',
    description:
      'Six estate homes on generous plots overlooking the Montgomerie golf course. Interiors are arranged around a double-height reception hall, with staff accommodation and a separate guest wing.',
    bedrooms: '5 to 7 bedrooms',
    size: '9,800 to 14,600 sq. ft.',
    handover: 'To be confirmed',
    entryFrom: 'Price on request',
    yieldPct: 'Not provided',
    features: ['Golf course and lake views', 'Guest wing and staff quarters', 'Indoor pool and gym', 'Four car garage', 'Plot sizes from 14,000 sq. ft.'],
  },
  {
    slug: 'business-bay',
    name: 'Msheireb Business Bay Heights',
    area: 'Business Bay, Dubai',
    configuration: 'Studio to 3 bedroom residences',
    price: 'Price on request',
    image: PHOTOS['business-bay'],
    alt: 'Peaceful night view of the urban waterfront in Frankfurt with moored boats and illuminated buildings',
    summary: 'Canal-facing homes with a co-working floor and a lap pool on the roof.',
    description:
      'A canal-front tower of compact, well-planned homes for people who work in the city. A co-working floor sits at level twelve, with the lap pool and residents lounge above it.',
    bedrooms: 'Studio to 3 bedrooms',
    size: '520 to 1,980 sq. ft.',
    handover: 'To be confirmed',
    entryFrom: 'Price on request',
    yieldPct: 'Not provided',
    features: ['Canal-facing homes', 'Co-working floor', 'Rooftop lap pool', 'EV charging in basement', 'Walk to Business Bay metro'],
  },
  {
    slug: 'jumeirah-golf',
    name: 'Msheireb Jumeirah Golf Villas',
    area: 'Jumeirah Golf Estates, Dubai',
    configuration: '3 & 4 bedroom golf villas',
    price: 'Price on request',
    image: PHOTOS['jumeirah-golf'],
    alt: 'Groundskeeper mowing the green on a golf course during a sunny day, showcasing lush landscapes and maintenance',
    summary: 'Fairway villas with walled gardens and a shared clubhouse.',
    description:
      'Twenty villas along the ninth fairway, each with a walled garden and a first-floor terrace over the green. The clubhouse has a pool, gym and a residents dining room.',
    bedrooms: '3 & 4 bedrooms',
    size: '3,900 to 5,600 sq. ft.',
    handover: 'To be confirmed',
    entryFrom: 'Price on request',
    yieldPct: 'Not provided',
    features: ['Direct fairway frontage', 'Walled private garden', 'Clubhouse pool and gym', 'Golf membership included', 'Two covered bays'],
  },
  {
    slug: 'city-walk',
    name: 'Msheireb City Walk Terraces',
    area: 'City Walk, Dubai',
    configuration: '2 & 3 bedroom terraced homes',
    price: 'Price on request',
    image: PHOTOS['city-walk'],
    alt: 'Elegant poolside terrace with palm trees and modern buildings in the background',
    summary: 'Terraced homes over the boulevard, with a quiet pool deck behind.',
    description:
      'Terraced homes above the City Walk boulevard, arranged so living rooms face inward to a planted courtyard and pool deck rather than the street.',
    bedrooms: '2 & 3 bedrooms',
    size: '2,100 to 3,200 sq. ft.',
    handover: 'To be confirmed',
    entryFrom: 'Price on request',
    yieldPct: 'Not provided',
    features: ['Private roof terrace', 'Courtyard pool deck', 'Walk to City Walk dining', 'Concierge and valet', 'Two parking bays'],
  },
  {
    slug: 'difc',
    name: 'Msheireb DIFC Residences',
    area: 'DIFC, Dubai',
    configuration: '1 to 3 bedroom residences',
    price: 'Price on request',
    image: PHOTOS['difc'],
    alt: 'A serene view of a modern city skyline with tall glass buildings at dusk',
    summary: 'Quiet, high-floor homes a lift ride from the Gate District.',
    description:
      'High-floor homes above the financial district, with acoustic glazing and a residents only entrance away from the office lobby. A club floor holds the gym, pool and private dining room.',
    bedrooms: '1 to 3 bedrooms',
    size: '880 to 2,600 sq. ft.',
    handover: 'To be confirmed',
    entryFrom: 'Price on request',
    yieldPct: 'Not provided',
    features: ['Residents only entrance', 'Acoustic glazing throughout', 'Club floor with private dining', 'Walk to DIFC offices', 'Two parking bays with valet'],
  },
  {
    slug: 'bluewaters',
    name: 'Msheireb Bluewaters Island Homes',
    area: 'Bluewaters Island, Dubai',
    configuration: '2 & 3 bedroom island apartments',
    price: 'Price on request',
    image: PHOTOS['bluewaters'],
    alt: 'Stunning view of seaside buildings along the promenade in İzmir, Türkiye, under a clear blue sky',
    summary: 'Island apartments with wrap terraces facing the Ain Dubai wheel.',
    description:
      'Island living a short walk from the beach clubs, with wrap-around terraces framing the wheel and the open sea. The building has a pool deck and a residents beach club.',
    bedrooms: '2 & 3 bedrooms',
    size: '1,600 to 2,700 sq. ft.',
    handover: 'To be confirmed',
    entryFrom: 'Price on request',
    yieldPct: 'Not provided',
    features: ['Wrap-around sea terraces', 'Residents beach club', 'Pool deck and gym', 'Short walk to beach clubs', 'Two parking bays'],
  },
  {
    slug: 'al-wasl',
    name: 'Msheireb Al Wasl Garden Residences',
    area: 'Al Wasl, Dubai',
    configuration: '3 & 4 bedroom residences',
    price: 'Price on request',
    image: PHOTOS['al-wasl'],
    alt: 'A modern villa with palm trees in a tropical setting under a clear blue sky',
    summary: 'Garden-facing homes on a quiet street behind Jumeirah.',
    description:
      'A low building of eighteen homes on a quiet Al Wasl street, with deep planted terraces and living rooms that open fully to the garden.',
    bedrooms: '3 & 4 bedrooms',
    size: '2,400 to 3,600 sq. ft.',
    handover: 'To be confirmed',
    entryFrom: 'Price on request',
    yieldPct: 'Not provided',
    features: ['Deep planted terraces', 'Private garden for ground homes', 'Residents pool', 'Walk to Jumeirah beaches', 'Two parking bays'],
  },
  {
    slug: 'dubai-hills',
    name: 'Msheireb Dubai Hills Courtyard Villas',
    area: 'Dubai Hills Estate, Dubai',
    configuration: '4 & 5 bedroom courtyard villas',
    price: 'Price on request',
    image: PHOTOS['dubai-hills'],
    alt: 'Luxurious Bali villa with private pool, tropical plants, and modern minimalist decor',
    summary: 'Courtyard villas facing the park, with a pool in every garden.',
    description:
      'Villas arranged around private courtyards on the edge of Dubai Hills Park. Every home has a pool garden and a first-floor terrace looking over the parkland.',
    bedrooms: '4 & 5 bedrooms',
    size: '4,400 to 6,200 sq. ft.',
    handover: 'To be confirmed',
    entryFrom: 'Price on request',
    yieldPct: 'Not provided',
    features: ['Park frontage', 'Private pool garden', 'Courtyard plan', 'Dubai Hills golf nearby', 'Two covered bays'],
  },
  {
    slug: 'jumeirah-bay',
    name: 'Msheireb Jumeirah Bay Water Homes',
    area: 'Jumeirah Bay Island, Dubai',
    configuration: '4 & 5 bedroom water villas',
    price: 'Price on request',
    image: PHOTOS['jumeirah-bay'],
    alt: 'Elegant stone villa with infinity pool offers serene vacation vibes at twilight',
    summary: 'Water-facing villas with private moorings on Jumeirah Bay.',
    description:
      'Nine villas on the inner water of Jumeirah Bay, each with a private mooring and a pool terrace facing the open sea.',
    bedrooms: '4 & 5 bedrooms',
    size: '7,200 to 10,400 sq. ft.',
    handover: 'To be confirmed',
    entryFrom: 'Price on request',
    yieldPct: 'Not provided',
    features: ['Private mooring', 'Pool terrace facing the sea', 'Beach club membership', 'Staff accommodation', 'Three parking bays'],
  },
  {
    slug: 'tilal-al-ghaf',
    name: 'Msheireb Tilal Al Ghaf Lagoon Homes',
    area: 'Tilal Al Ghaf, Dubai',
    configuration: '3 & 4 bedroom lagoon villas',
    price: 'Price on request',
    image: PHOTOS['tilal-al-ghaf'],
    alt: 'Aerial photo of a luxurious island resort surrounded by turquoise waters',
    summary: 'Villas on a white sand lagoon with a beach club at the centre.',    description:
      'Homes on the white sand lagoon at Tilal Al Ghaf, with beach frontage for the water-facing plots and a residents beach club at the centre of the community.',
    bedrooms: '3 & 4 bedrooms',
    size: '3,200 to 4,800 sq. ft.',
    handover: 'To be confirmed',
    entryFrom: 'Price on request',
    yieldPct: 'Not provided',
    features: ['Lagoon beach frontage', 'Residents beach club', 'Walled garden', 'Community pool and gym', 'Two covered bays'],
  },
  {
    slug: 'mudon',
    name: 'Msheireb Mudon Al Ranim Townhouses',
    area: 'Mudon, Dubai',
    configuration: '3 & 4 bedroom townhouses',
    price: 'Price on request',
    image: PHOTOS['mudon'],
    alt: 'Charming sunset reflection on modern Dutch townhouses in Almere, Netherlands',
    summary: 'Townhouses around a park with a pool and a community centre.',
    description:
      'A terrace of townhouses facing the central park at Mudon Al Ranim, with private gardens and a shared pool and community centre a short walk away.',
    bedrooms: '3 & 4 bedrooms',
    size: '2,300 to 3,100 sq. ft.',
    handover: 'To be confirmed',
    entryFrom: 'Price on request',
    yieldPct: 'Not provided',
    features: ['Park frontage', 'Private rear garden', 'Community pool and gym', 'Two parking bays', 'Family friendly streets'],
  },
  {
    slug: 'arabian-ranches',
    name: 'Msheireb Arabian Ranches Estate Villas',
    area: 'Arabian Ranches, Dubai',
    configuration: '4 & 5 bedroom estate villas',
    price: 'Price on request',
    image: PHOTOS['arabian-ranches'],
    alt: 'Elegant brick mansion with manicured lawn and garden under a bright blue sky',
    summary: 'Established villas with mature gardens beside the golf course.',
    description:
      'Six established villas with mature gardens on the Arabian Ranches golf course, renovated to the current Msheireb specification.',
    bedrooms: '4 & 5 bedrooms',
    size: '4,100 to 5,900 sq. ft.',
    handover: 'To be confirmed',
    entryFrom: 'Price on request',
    yieldPct: 'Not provided',
    features: ['Golf course views', 'Mature private garden', 'Renovated interiors', 'Community pools and courts', 'Two covered bays'],
  },
  {
    slug: 'the-valley',
    name: 'Msheireb The Valley Garden Townhouses',
    area: 'The Valley, Dubai',
    configuration: '3 & 4 bedroom townhouses',
    price: 'Price on request',
    image: PHOTOS['the-valley'],
    alt: 'Wide-angle view of a sunny suburban street with modern homes and a clear blue sky, capturing peaceful residential living',
    summary: 'New townhouses around a town centre and a swim lake.',
    description:
      'Townhouses in the first phase of The Valley, arranged around a swim lake and a walkable town centre with shops and schools planned alongside.',
    bedrooms: '3 & 4 bedrooms',
    size: '2,000 to 2,900 sq. ft.',
    handover: 'To be confirmed',
    entryFrom: 'Price on request',
    yieldPct: 'Not provided',
    features: ['Swim lake and beach', 'Town centre planned', 'Private garden', 'Community pool', 'Two parking bays'],
  },
  {
    slug: 'jumeirah-islands',
    name: 'Msheireb Jumeirah Islands Pavilions',
    area: 'Jumeirah Islands, Dubai',
    configuration: '4 & 5 bedroom pavilion villas',
    price: 'Price on request',
    image: PHOTOS['jumeirah-islands'],
    alt: 'Elegant stone villa with illuminated facade, pool, and relaxing outdoor area',
    summary: 'Lake-front pavilion villas with a garden pavilion for entertaining.',
    description:
      'Lake-front villas on Jumeirah Islands with a detached garden pavilion for dining and entertaining, and a pool terrace facing the water.',
    bedrooms: '4 & 5 bedrooms',
    size: '5,600 to 7,800 sq. ft.',
    handover: 'To be confirmed',
    entryFrom: 'Price on request',
    yieldPct: 'Not provided',
    features: ['Lake frontage', 'Detached garden pavilion', 'Pool terrace', 'Clubhouse and courts', 'Three parking bays'],
  },
  {
    slug: 'creek-harbour',
    name: 'Msheireb Creek Harbour Skyline Homes',
    area: 'Dubai Creek Harbour, Dubai',
    configuration: '2 & 3 bedroom skyline apartments',
    price: 'Price on request',
    image: PHOTOS['creek-harbour'],
    alt: 'Stunning view of Dubai Creek waterfront with modern skyscrapers and reflected city lights',
    summary: 'Creek-facing apartments with a skyline view and a marina below.',
    description:
      'Apartments facing the creek and the skyline, above a marina promenade with restaurants and a waterfront park. The building has a pool deck and a residents lounge on level thirty.',
    bedrooms: '2 & 3 bedrooms',
    size: '1,200 to 2,200 sq. ft.',
    handover: 'To be confirmed',
    entryFrom: 'Price on request',
    yieldPct: 'Not provided',
    features: ['Creek and skyline views', 'Marina promenade below', 'Pool deck and residents lounge', 'Waterfront park', 'Two parking bays'],
  },
]

function bedroomCount(label: string): number {
  const match = label.match(/(\d+)/)
  const parsed = match ? Number(match[1]) : 3
  return Math.min(6, Math.max(1, parsed))
}

function planSet(slug: string, bedrooms: string, size: string, secondBedrooms: string, secondSize: string): FloorPlan[] {
  const beds = bedroomCount(bedrooms)
  const upperBeds = Math.max(1, beds - 1)
  const seed = slug.split('').reduce((total, char) => total + char.charCodeAt(0), 0)
  const hasMaid = beds >= 4 || seed % 3 === 0
  const hasStudy = seed % 2 === 0
  const terraceDepth = 8 + (seed % 3) * 2

  const bedroomRow = (count: number, y: number, height: number): Room[] => {
    const rooms: Room[] = []
    const bathWidth = count > 3 ? 16 : 20
    const available = 100 - bathWidth
    const each = available / count
    for (let index = 0; index < count; index += 1) {
      rooms.push({
        x: Number((index * each).toFixed(2)),
        y,
        w: Number(each.toFixed(2)),
        h: height,
        label: index === 0 ? 'Master suite' : `Bedroom ${index + 1}`,
      })
    }
    rooms.push({
      x: Number(available.toFixed(2)),
      y,
      w: bathWidth,
      h: height,
      label: count > 3 ? 'Baths' : 'Baths & dressing',
      tone: 'wet',
    })
    return rooms
  }

  const gardenRooms: Room[] = [
    { x: 0, y: 0, w: 100, h: terraceDepth, label: 'Private terrace & pool', tone: 'terrace' },
    { x: 0, y: terraceDepth, w: 38, h: 26, label: 'Living room', tone: 'living' },
    { x: 38, y: terraceDepth, w: 20, h: 14, label: 'Dining' },
    { x: 58, y: terraceDepth, w: 20, h: 14, label: 'Kitchen' },
    {
      x: 78,
      y: terraceDepth,
      w: 22,
      h: 14,
      label: hasMaid ? 'Maid’s room' : 'Pantry',
      tone: hasMaid ? 'wet' : undefined,
    },
    { x: 38, y: terraceDepth + 14, w: 20, h: 12, label: 'Family bath', tone: 'wet' },
    {
      x: 58,
      y: terraceDepth + 14,
      w: 20,
      h: 12,
      label: hasStudy ? 'Study' : 'Library',
    },
    { x: 78, y: terraceDepth + 14, w: 22, h: 12, label: 'Entry & lift' },
    ...bedroomRow(beds, terraceDepth + 26, 24),
  ]

  const upperRooms: Room[] = [
    { x: 0, y: 0, w: 100, h: terraceDepth, label: 'Balcony', tone: 'terrace' },
    { x: 0, y: terraceDepth, w: 34, h: 24, label: 'Living room', tone: 'living' },
    { x: 34, y: terraceDepth, w: 18, h: 14, label: 'Dining' },
    { x: 52, y: terraceDepth, w: 18, h: 14, label: 'Kitchen' },
    { x: 70, y: terraceDepth, w: 14, h: 14, label: 'Utility', tone: 'wet' },
    { x: 84, y: terraceDepth, w: 16, h: 14, label: 'Guest room' },
    { x: 34, y: terraceDepth + 14, w: 18, h: 10, label: 'Powder', tone: 'wet' },
    { x: 52, y: terraceDepth + 14, w: 32, h: 10, label: 'Gallery & stair' },
    { x: 84, y: terraceDepth + 14, w: 16, h: 10, label: 'Store' },
    ...bedroomRow(upperBeds, terraceDepth + 24, 22),
  ]

  return [
    {
      id: `${slug}-garden`,
      name: 'Garden layout',
      bedrooms,
      size,
      width: 100,
      height: terraceDepth + 50,
      rooms: gardenRooms,
    },
    {
      id: `${slug}-upper`,
      name: 'Upper layout',
      bedrooms: secondBedrooms,
      size: secondSize,
      width: 100,
      height: terraceDepth + 46,
      rooms: upperRooms,
    },
  ]
}
const EXTRA_RESIDENCES: Residence[] = LISTING_SEEDS.map((seed) => ({
  slug: seed.slug as ResidenceSlug,
  name: seed.name,
  area: seed.area,
  configuration: seed.configuration,
  price: seed.price,
  image: seed.image,
  alt: seed.alt,
  summary: seed.summary,
  description: seed.description,
  bedrooms: seed.bedrooms,
  size: seed.size,
  handover: seed.handover,
  features: seed.features,
  gallery: [
    { src: seed.image, caption: `${seed.name}, exterior` },
    { src: IMAGES.living, caption: 'Living room at golden hour' },
    { src: IMAGES.pool, caption: 'The pool terrace' },
    { src: IMAGES.detail, caption: 'Travertine and bronze detail' },
    { src: IMAGES.lowrise, caption: 'Facade and planting' },
  ],
  plans: planSet(seed.slug, seed.bedrooms, seed.size, `${Math.max(1, bedroomCount(seed.bedrooms) - 1)} bedroom layout`, seed.size),
  investment: {
    entryFrom: seed.entryFrom,
    yieldPct: seed.yieldPct,
    options: [
      { name: '20 / 80 plan', detail: '20% on booking, 80% on handover.' },
      { name: 'Mortgage assisted', detail: 'Introductions to three UAE lenders, up to 75% loan to value.' },
      { name: 'Payment plan', detail: '40% during construction, 60% on handover.' },
    ],
    note: 'Prices are indicative and confirmed by the sales gallery at reservation.',
  },
}))

RESIDENCES.push(...EXTRA_RESIDENCES)

 
// Curated Dubai catalogue. Names are proposed marketing labels; verify all project details before publication.
const jvcTemplate = RESIDENCES.find((residence) => residence.slug === 'business-bay')
if (!jvcTemplate) throw new Error('Missing residence template for JVC listing')
const jvcResidence: Residence = { ...jvcTemplate, slug: 'jvc' as ResidenceSlug }
RESIDENCES.push(jvcResidence)

const PROPERTY_CATALOGUE = [
  { slug: 'downtown', name: 'Burj Vista Residences', area: 'Downtown Dubai' },
  { slug: 'business-bay', name: 'The Opus Residences', area: 'Business Bay' },
  { slug: 'marina', name: 'Marina Gate Residences', area: 'Dubai Marina' },
  { slug: 'palm-jumeirah', name: 'Palm Luxury Residences', area: 'Palm Jumeirah' },
  { slug: 'dubai-hills', name: 'Hills Estate Villas', area: 'Dubai Hills Estate' },
  { slug: 'jvc', name: 'Garden Heights Residences', area: 'Jumeirah Village Circle' },
  { slug: 'creek-harbour', name: 'Creek Waterfront Residences', area: 'Dubai Creek Harbour' },
  { slug: 'arabian-ranches', name: 'Arabian Ranches Villas', area: 'Arabian Ranches' },
] as const

const selectedResidences = PROPERTY_CATALOGUE.map((listing) => {
  const residence = RESIDENCES.find((item) => item.slug === listing.slug)
  if (!residence) throw new Error(`Missing property detail for ${listing.slug}`)
  residence.name = listing.name
  residence.area = listing.area + ', Dubai'
  residence.configuration = 'Property details on request'
  residence.price = 'Price on request'
  residence.alt = 'Illustrative luxury property concept image; actual property imagery to be confirmed'
  residence.summary = `Luxury property listing in ${listing.area}, Dubai.`
  residence.description = 'This is a proposed catalogue listing name and location. The development identity, ownership, availability, specifications, images and prices have not been independently verified. Contact the Msheireb Properties team for confirmed information.'
  residence.bedrooms = 'Details on request'
  residence.size = 'Details on request'
  residence.handover = 'To be confirmed'
  residence.features = ['Details available on request']
  residence.gallery = residence.gallery.map((shot) => ({ ...shot, caption: 'Illustrative concept image — verify before publication' }))
  residence.plans = []
  residence.investment = {
    entryFrom: 'Price on request',
    yieldPct: 'Not provided',
    options: [],
    note: 'Illustrative preview only. No verified price, rental yield, service charge, payment plan or investment return is represented. Confirm all details before publication.',
  }
  return residence
})
RESIDENCES.splice(0, RESIDENCES.length, ...selectedResidences)
