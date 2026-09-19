'use client'

import { supabase } from '@/utils/supabase'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage('')
    setIsLoading(true)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    setIsLoading(false)

    if (error) {
      setMessage('로그인 실패: ' + error.message)
      return
    }

    router.push('/')
    router.refresh()
  }

  return (
    <main className="min-h-screen bg-orange-50 p-8 text-zinc-900">
      <section className="mx-auto max-w-md rounded-3xl bg-white p-6 shadow-sm ring-1 ring-orange-100">
        <p className="mb-2 text-sm font-semibold text-orange-600">로그인</p>
        <h1 className="mb-6 text-2xl font-bold">읽기 세션 시작하기</h1>

        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="email"
            placeholder="이메일"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-2xl border border-orange-100 p-3 outline-none focus:border-orange-400"
          />
          <input
            type="password"
            placeholder="비밀번호"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-2xl border border-orange-100 p-3 outline-none focus:border-orange-400"
          />
          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-2xl bg-orange-600 px-4 py-3 font-bold text-white disabled:opacity-60"
          >
            {isLoading ? '로그인 중...' : '로그인'}
          </button>
        </form>

        {message ? <p className="mt-4 text-sm text-red-600">{message}</p> : null}
        <p className="mt-4 text-sm text-zinc-600">
          계정이 없나요? <a href="/signup" className="font-semibold underline">회원가입</a>
        </p>
      </section>
    </main>
  )
}
