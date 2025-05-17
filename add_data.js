'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/Header'
import { User } from '@supabase/supabase-js'
import { Database } from '@/types/database'

type Dataset = Database['public']['Tables']['datasets']['Row']

export default function AddDataPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [selectedDataset, setSelectedDataset] = useState<string>('')
  const [content, setContent] = useState('')
  const [label, setLabel] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
      } else {
        setUser(user)
        // Fetch user's datasets
        const { data: datasets, error } = await supabase
          .from('datasets')
          .select('*')
          .order('created_at', { ascending: false })
        
        if (error) {
          console.error('Error fetching datasets:', error)
        } else {
          setDatasets(datasets)
          // Set initial dataset from URL if present
          const params = new URLSearchParams(window.location.search)
          const datasetId = params.get('dataset')
          if (datasetId) {
            setSelectedDataset(datasetId)
          }
        }
      }
      setLoading(false)
    }

    getUser()
  }, [router, supabase.auth])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !selectedDataset || !content.trim() || !label.trim()) return

    setSubmitting(true)
    setError(null)

    try {
      // Create the data point
      const { data: dataPoint, error: dataPointError } = await supabase
        .from('data_points')
        .insert({
          user_id: user.id,
          content: content.trim()
        })
        .select()
        .single()

      if (dataPointError) throw dataPointError

      // Create the association
      const { error: associationError } = await supabase
        .from('dataset_data_points')
        .insert({
          dataset_id: selectedDataset,
          data_point_id: dataPoint.id,
          label: label.trim()
        })

      if (associationError) throw associationError

      // Reset form
      setContent('')
      setLabel('')
      setSuccess('Data point added successfully!')
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      console.error('Error adding data point:', err)
      setError('Failed to add data point. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

}
