import { createFileRoute } from '@tanstack/react-router'
import { ResidenceDetail } from '../components/residence-detail'
import { canonicalUrl } from '../lib/canonical-url'
import siteMetadata from '../metadata.json'

const meta = siteMetadata['/residences/al-barari']

export const Route = createFileRoute('/residences/al-barari')({
  head: () => {
    const canonical = canonicalUrl('/residences/al-barari')
    return {
      meta: [
        { title: meta.title },
        { name: 'description', content: meta.description },
      ],
      links: canonical ? [{ rel: 'canonical', href: canonical }] : [],
    }
  },
  component: () => <ResidenceDetail slug="al-barari" />,
})
