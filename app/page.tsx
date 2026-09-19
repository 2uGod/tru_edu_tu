'use client'

import { supabase } from '@/utils/supabase'
import type { User } from '@supabase/supabase-js'
import Link from 'next/link'
import { useEffect, useState } from 'react'

type Story = {
  id: string
  title: string
  lines: string[]
  question: string
  choices: string[]
  answer_index: number
  order_items: string[]
}

type Profile = {
  id: string
  role: 'parent' | 'child'
  name: string
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [stories, setStories] = useState<Story[]>([])
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [attemptCount, setAttemptCount] = useState(0)
  const [message, setMessage] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  const todayStory = stories[0]
  const isCorrect =
    selectedIndex !== null && todayStory ? selectedIndex === todayStory.answer_index : null

  useEffect(() => {
    const loadPrivateData = async (currentUser: User) => {
      const [{ data: profileData }, { data: storyData }] = await Promise.all([
        supabase
          .from('users')
          .select('id, role, name')
          .eq('id', currentUser.id)
          .maybeSingle(),
        supabase.from('stories').select('*').order('created_at', { ascending: true }),
      ])

      setProfile(profileData as Profile | null)
      setStories((storyData ?? []) as Story[])
    }

    const loadInitialData = async () => {
      const { data } = await supabase.auth.getUser()
      const currentUser = data.user

      setUser(currentUser)

      if (currentUser) {
        await loadPrivateData(currentUser)
      }

      setIsLoading(false)
    }

    void loadInitialData()

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null
      setUser(currentUser)

      if (currentUser) {
        void loadPrivateData(currentUser)
      } else {
        setProfile(null)
        setStories([])
        setSelectedIndex(null)
        setAttemptCount(0)
        setMessage('')
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  const handleAnswer = async (index: number) => {
    if (!todayStory || !user) return

    const nextAttemptCount = attemptCount + 1
    const correct = index === todayStory.answer_index

    setSelectedIndex(index)
    setAttemptCount(nextAttemptCount)
    setMessage(correct ? '정답이에요!' : '다시 생각해 볼까요?')

    const { data: session } = await supabase
      .from('sessions')
      .insert({
        user_id: user.id,
        story_id: todayStory.id,
        status: 'question',
        current_step: 'question',
      })
      .select('id')
      .single()

    if (session) {
      await supabase.from('question_answers').insert({
        user_id: user.id,
        story_id: todayStory.id,
        session_id: session.id,
        selected_index: index,
        is_correct: correct,
        attempt_count: nextAttemptCount,
      })
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
    setStories([])
  }

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-orange-50 p-8 text-zinc-900">
        <p className="rounded-2xl bg-white px-5 py-4 text-sm text-zinc-500 shadow-sm ring-1 ring-orange-100">
          로그인 상태를 확인하는 중...
        </p>
      </main>
    )
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-orange-50 p-8 text-zinc-900">
        <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-4xl flex-col justify-center gap-8">
          <div className="max-w-2xl">
            <p className="mb-3 text-sm font-semibold text-orange-600">읽기·그림 세션</p>
            <h1 className="text-4xl font-extrabold leading-tight sm:text-5xl">
              부모와 아이가 함께 만드는 나만의 책
            </h1>
            <p className="mt-5 text-lg leading-8 text-zinc-600">
              아이가 이야기를 읽고, 이해 질문에 답하고, 직접 제목과 그림을 더해 완성된 책을 만들어요.
              로그인하면 오늘 세션과 답변 기록을 저장할 수 있습니다.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <article className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-orange-100">
              <p className="text-2xl font-bold text-orange-600">1</p>
              <h2 className="mt-3 font-bold">역할 선택</h2>
              <p className="mt-2 text-sm text-zinc-500">보호자 또는 아이 계정으로 시작해요.</p>
            </article>
            <article className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-orange-100">
              <p className="text-2xl font-bold text-orange-600">2</p>
              <h2 className="mt-3 font-bold">이야기 읽기</h2>
              <p className="mt-2 text-sm text-zinc-500">오늘의 이야기를 문장별로 천천히 읽어요.</p>
            </article>
            <article className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-orange-100">
              <p className="text-2xl font-bold text-orange-600">3</p>
              <h2 className="mt-3 font-bold">이해 기록</h2>
              <p className="mt-2 text-sm text-zinc-500">질문 답변과 재시도 기록을 남겨요.</p>
            </article>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/login"
              className="rounded-2xl bg-orange-600 px-6 py-4 text-center font-bold text-white shadow-sm"
            >
              로그인하기
            </Link>
            <Link
              href="/signup"
              className="rounded-2xl bg-white px-6 py-4 text-center font-bold text-orange-700 shadow-sm ring-1 ring-orange-100"
            >
              회원가입하기
            </Link>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-orange-50 p-8 text-zinc-900">
      <section className="mx-auto flex max-w-4xl flex-col gap-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="mb-2 text-sm font-semibold text-orange-600">오늘 세션</p>
            <h1 className="text-3xl font-bold">부모와 아이가 함께 읽는 나만의 책</h1>
            <p className="mt-3 text-zinc-600">
              오늘의 이야기를 한 줄씩 읽은 뒤 이해 질문에 답해요.
            </p>
          </div>

          <div className="rounded-2xl bg-white p-4 text-sm shadow-sm ring-1 ring-orange-100">
            <div className="space-y-2">
              <p className="font-semibold">{profile?.name ?? user.email}</p>
              <p className="text-zinc-500">{profile?.role === 'parent' ? '보호자' : '아이'} 계정</p>
              <p className="text-zinc-500">{user.email}</p>
              <button onClick={handleLogout} className="font-semibold text-orange-700 underline">
                로그아웃
              </button>
            </div>
          </div>
        </header>

        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-orange-100">
          <h2 className="mb-4 text-xl font-bold">오늘 읽을 이야기</h2>
          {todayStory ? (
            <article>
              <h3 className="text-2xl font-bold text-orange-700">{todayStory.title}</h3>
              <ol className="mt-5 space-y-3">
                {todayStory.lines.map((line, index) => (
                  <li key={`${todayStory.id}-line-${index}`} className="rounded-2xl bg-orange-50 p-4">
                    <span className="mr-3 font-bold text-orange-500">{index + 1}</span>
                    {line}
                  </li>
                ))}
              </ol>
            </article>
          ) : (
            <p className="text-sm text-zinc-500">등록된 이야기가 없습니다.</p>
          )}
        </section>

        {todayStory ? (
          <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-orange-100">
            <h2 className="mb-4 text-xl font-bold">이해 질문</h2>
            <p className="text-lg font-semibold">{todayStory.question}</p>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {todayStory.choices.map((choice, index) => {
                const isSelected = selectedIndex === index
                return (
                  <li key={`${todayStory.id}-choice-${index}`}>
                    <button
                      type="button"
                      onClick={() => handleAnswer(index)}
                      className={`w-full rounded-2xl border p-4 text-left ${
                        isSelected
                          ? isCorrect
                            ? 'border-green-500 bg-green-50'
                            : 'border-red-500 bg-red-50'
                          : 'border-orange-100 bg-white hover:bg-orange-50'
                      }`}
                    >
                      <span className="mr-3 font-bold text-orange-500">{index + 1}</span>
                      {choice}
                    </button>
                  </li>
                )
              })}
            </ul>
            {message ? <p className="mt-4 font-semibold text-orange-700">{message}</p> : null}
          </section>
        ) : null}
      </section>
    </main>
  )
}
