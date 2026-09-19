'use client'

import { supabase } from '@/utils/supabase'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function SignUp() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<'parent' | 'child'>('child')
  const [message, setMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage('')
    setIsLoading(true)

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) {
      setMessage('오류: ' + error.message)
      setIsLoading(false)
      return
    }

    if (data.user) {
      const { error: profileError } = await supabase.from('users').upsert({
        id: data.user.id,
        role,
        name: name || email,
      })

      if (profileError) {
        setMessage('가입은 되었지만 프로필 저장에 실패했습니다: ' + profileError.message)
        setIsLoading(false)
        return
      }
    }

    setMessage('가입 완료. 로그인 페이지로 이동합니다.')
    setTimeout(() => router.push('/login'), 1000)
  }

  return (
    <main className="min-h-screen bg-orange-50 p-8 text-zinc-900">
      <section className="mx-auto max-w-md rounded-3xl bg-white p-6 shadow-sm ring-1 ring-orange-100">
        <p className="mb-2 text-sm font-semibold text-orange-600">회원가입</p>
        <h1 className="mb-6 text-2xl font-bold">읽기 세션 계정 만들기</h1>

        <form onSubmit={handleSignUp} className="space-y-4">
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
            placeholder="비밀번호 (6자 이상)"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-2xl border border-orange-100 p-3 outline-none focus:border-orange-400"
          />
          <input
            type="text"
            placeholder="이름"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-2xl border border-orange-100 p-3 outline-none focus:border-orange-400"
          />

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setRole('child')}
              className={`rounded-2xl border p-3 font-semibold ${
                role === 'child' ? 'border-orange-500 bg-orange-100 text-orange-700' : 'border-orange-100'
              }`}
            >
              아이
            </button>
            <button
              type="button"
              onClick={() => setRole('parent')}
              className={`rounded-2xl border p-3 font-semibold ${
                role === 'parent' ? 'border-orange-500 bg-orange-100 text-orange-700' : 'border-orange-100'
              }`}
            >
              보호자
            </button>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-2xl bg-orange-600 px-4 py-3 font-bold text-white disabled:opacity-60"
          >
            {isLoading ? '가입 중...' : '가입하기'}
          </button>
        </form>

        {message ? <p className="mt-4 text-sm text-zinc-600">{message}</p> : null}
        <p className="mt-4 text-sm text-zinc-600">
          이미 계정이 있나요? <a href="/login" className="font-semibold underline">로그인</a>
        </p>
      </section>
    </main>
  )
}
