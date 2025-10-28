import Image from 'next/image'
import logo from '@/assets/logo.png'
import { ReactNode } from 'react'

type Props = {
  children: ReactNode
  size?: 'sm' | 'md' | 'lg'
  as?: keyof JSX.IntrinsicElements
}

const sizeMap = {
  sm: 'text-lg',
  md: 'text-xl',
  lg: 'text-2xl',
} as const

export default function Title({ children, size = 'lg', as: Tag = 'h1' }: Props) {
  return (
    <Tag className={`flex items-center gap-2 font-bold ${sizeMap[size]}`}>
      <Image src={logo} alt="Logo" width={28} height={28} className="select-none" />
      <span>{children}</span>
    </Tag>
  )
}
