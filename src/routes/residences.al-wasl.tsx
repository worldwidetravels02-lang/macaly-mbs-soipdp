import { createFileRoute } from '@tanstack/react-router'
import { ResidenceDetail } from '../components/residence-detail'
import { canonicalUrl } from '../lib/canonical-url'
import siteMetadata from '../metadata.json'

const meta = siteMetadata['/residences/al-wasl']

export const Route = createFileRoute('/residences/al-wasl')({
  head: () => {
    const canonical = canonicalUrl('/residences/al-wasl')
    return {
      meta: [
        { title: meta.title },
        { name: 'description', content: meta.description },
      ],
      links: canonical ? [{ rel: 'canonical', href: canonical }] : [],
    }
  },
  component: () => <ResidenceDetail slug="al-wasl" />,
})
