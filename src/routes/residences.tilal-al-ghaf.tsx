import { createFileRoute } from '@tanstack/react-router'
import { ResidenceDetail } from '../components/residence-detail'
import { canonicalUrl } from '../lib/canonical-url'
import siteMetadata from '../metadata.json'

const meta = siteMetadata['/residences/tilal-al-ghaf']

export const Route = createFileRoute('/residences/tilal-al-ghaf')({
  head: () => {
    const canonical = canonicalUrl('/residences/tilal-al-ghaf')
    return {
      meta: [
        { title: meta.title },
        { name: 'description', content: meta.description },
      ],
      links: canonical ? [{ rel: 'canonical', href: canonical }] : [],
    }
  },
  component: () => <ResidenceDetail slug="tilal-al-ghaf" />,
})
