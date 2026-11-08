import { IMAGES } from './site'

export type MemberProject = {
  id: string
  name: string
  area: string
  price: string
  image: string
  alt: string
}

/** The eight curated Dubai catalogue listings shown in the member dashboard. */
export const MEMBER_PROJECTS: MemberProject[] = [
  {
    id: 'downtown',
    name: 'Burj Vista Residences',
    area: 'Downtown Dubai',
    price: 'Price on request',
    image: IMAGES.lowrise,
    alt: 'Illustrative luxury residence concept',
  },
  {
    id: 'business-bay',
    name: 'The Opus Residences',
    area: 'Business Bay',
    price: 'Price on request',
    image: IMAGES.tower,
    alt: 'Illustrative luxury tower concept',
  },
  {
    id: 'marina',
    name: 'Marina Gate Residences',
    area: 'Dubai Marina',
    price: 'Price on request',
    image: IMAGES.marinaNight,
    alt: 'Illustrative marina residence concept',
  },
  {
    id: 'palm-jumeirah',
    name: 'Palm Luxury Residences',
    area: 'Palm Jumeirah',
    price: 'Price on request',
    image: IMAGES.beachVilla,
    alt: 'Illustrative beachfront residence concept',
  },
  {
    id: 'dubai-hills',
    name: 'Hills Estate Villas',
    area: 'Dubai Hills Estate',
    price: 'Price on request',
    image: IMAGES.villas,
    alt: 'Illustrative luxury villa concept',
  },
  {
    id: 'jvc',
    name: 'Garden Heights Residences',
    area: 'Jumeirah Village Circle',
    price: 'Price on request',
    image: IMAGES.courtyard,
    alt: 'Illustrative garden residence concept',
  },
  {
    id: 'creek-harbour',
    name: 'Creek Waterfront Residences',
    area: 'Dubai Creek Harbour',
    price: 'Price on request',
    image: IMAGES.marinaNight,
    alt: 'Illustrative waterfront residence concept',
  },
  {
    id: 'arabian-ranches',
    name: 'Arabian Ranches Villas',
    area: 'Arabian Ranches',
    price: 'Price on request',
    image: IMAGES.villas,
    alt: 'Illustrative family villa concept',
  },
]
