import { useEffect, useState } from 'react'
import Home from './screens/Home'
import Quiz from './screens/Quiz'
import Summary from './screens/Summary'

export type Route =
  | { name: 'home' }
  | { name: 'quiz'; slot: string }
  | { name: 'review'; id: string; q: number }
  | { name: 'result'; id: string }

function parse(hash: string): Route {
  const [path, query] = hash.replace(/^#\/?/, '').split('?')
  const [name, arg] = path.split('/')
  if (name === 'quiz' && arg) return { name: 'quiz', slot: arg }
  if (name === 'result' && arg) return { name: 'result', id: arg }
  if (name === 'review' && arg) {
    const q = Number(new URLSearchParams(query).get('q') ?? 0)
    return { name: 'review', id: arg, q: Number.isFinite(q) ? q : 0 }
  }
  return { name: 'home' }
}

export function navigate(route: Route) {
  const hash =
    route.name === 'home'
      ? '#/'
      : route.name === 'quiz'
        ? `#/quiz/${route.slot}`
        : route.name === 'result'
          ? `#/result/${route.id}`
          : `#/review/${route.id}?q=${route.q}`
  window.location.hash = hash
}

export default function App() {
  const [route, setRoute] = useState(() => parse(window.location.hash))

  useEffect(() => {
    const onHash = () => {
      setRoute(parse(window.location.hash))
      window.scrollTo({ top: 0 })
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  switch (route.name) {
    case 'quiz':
      return <Quiz key={route.slot} slot={route.slot} />
    case 'review':
      return <Quiz key={`review-${route.id}`} reviewId={route.id} initialIndex={route.q} />
    case 'result':
      return <Summary key={route.id} id={route.id} />
    default:
      return <Home />
  }
}
