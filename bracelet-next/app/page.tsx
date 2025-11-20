import dynamic from 'next/dynamic'

const BraceletApp = dynamic(() => import('../components/BraceletApp'), {
  ssr: false,
  loading: () => <div style={{ padding: 32 }}>加载中...</div>
})

export default function HomePage() {
  return <BraceletApp />
}
