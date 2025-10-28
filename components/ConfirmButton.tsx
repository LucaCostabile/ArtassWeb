"use client"
import React from 'react'

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  message?: string
}

export default function ConfirmButton({ message = '¿Confirmás esta acción?', onClick, ...props }: Props) {
  return (
    <button
      {...props}
      onClick={(e) => {
        // Si hay un onClick externo, respetarlo primero
        if (onClick) onClick(e)
        if (e.defaultPrevented) return
        const ok = typeof window !== 'undefined' ? window.confirm(message) : true
        if (!ok) {
          e.preventDefault()
          e.stopPropagation()
        }
      }}
    />
  )
}
