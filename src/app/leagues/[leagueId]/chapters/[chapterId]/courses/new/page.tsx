"use client"

import { useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, MapPin, Building, Calendar, User, Trophy } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface CourseFormData {
  name: string
  location: string
  holeCount: number
  localRules: string
  latitude: string
  longitude: string
  architect: string
  yearBuilt: string
  courseRecord: string
  courseRecordHolder: string
}

interface NewCoursePageProps {
  params: Promise<{
    leagueId: string
    chapterId: string
  }>
}

export default function NewCoursePage({ params }: NewCoursePageProps) {
  const { leagueId, chapterId } = use(params)
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  
  const [formData, setFormData] = useState<CourseFormData>({
    name: '',
    location: '',
    holeCount: 18,
    localRules: '',
    latitude: '',
    longitude: '',
    architect: '',
    yearBuilt: '',
    courseRecord: '',
    courseRecordHolder: ''
  })

  const handleInputChange = (field: keyof CourseFormData, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleSubmit = async (action: 'draft' | 'save' | 'saveAndAddHoles') => {
    setIsSubmitting(true)
    
    try {
      // Prepare API data
      const courseData = {
        name: formData.name,
        location: formData.location || undefined,
        holeCount: formData.holeCount,
        localRules: formData.localRules || undefined,
        latitude: formData.latitude ? parseFloat(formData.latitude) : undefined,
        longitude: formData.longitude ? parseFloat(formData.longitude) : undefined,
        architect: formData.architect || undefined,
        yearBuilt: formData.yearBuilt ? parseInt(formData.yearBuilt) : undefined,
        courseRecord: formData.courseRecord ? parseInt(formData.courseRecord) : undefined,
        courseRecordHolder: formData.courseRecordHolder || undefined,
      }

      console.log('Creating course:', { courseData, action })
      
      // Call API to create course
      const response = await fetch(`/api/leagues/${leagueId}/courses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(courseData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error('API Error Response:', errorData)
        if (errorData.details) {
          console.error('Validation errors:', errorData.details)
        }
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
      }

      const result = await response.json()
      console.log('Course created successfully:', result)
      
      // Redirect based on action
      if (action === 'saveAndAddHoles') {
        // TODO: Navigate to hole configuration page
        router.push(`/leagues/${leagueId}/chapters/${chapterId}/courses/${result.course.id}/holes`)
      } else {
        // Navigate back to course list
        router.push(`/leagues/${leagueId}/chapters/${chapterId}/courses`)
      }
    } catch (error) {
      console.error('Error creating course:', error)
      // TODO: Show error message to user
      alert(`Failed to create course: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    router.push(`/leagues/${leagueId}/chapters/${chapterId}/courses`)
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href={`/leagues/${leagueId}/chapters/${chapterId}/courses`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Courses
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Add New Course</h1>
          <p className="text-muted-foreground">Create a custom course for your league</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Basic Information */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Building className="h-5 w-5" />
            <h2 className="text-xl font-semibold">Basic Information</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Course Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="Enter course name"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => handleInputChange('location', e.target.value)}
                placeholder="City, State or Address"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="holeCount">Number of Holes</Label>
              <select
                id="holeCount"
                value={formData.holeCount}
                onChange={(e) => handleInputChange('holeCount', parseInt(e.target.value))}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value={9}>9 Holes</option>
                <option value={18}>18 Holes</option>
                <option value={27}>27 Holes</option>
                <option value={36}>36 Holes</option>
              </select>
            </div>
            
            <div className="space-y-2 md:col-span-2">
              <div className="flex justify-between items-baseline">
                <Label htmlFor="localRules">Local Rules & Description</Label>
                <span className="text-sm text-muted-foreground">
                  {formData.localRules.length}/5000
                </span>
              </div>
              <Textarea
                id="localRules"
                value={formData.localRules}
                onChange={(e) => handleInputChange('localRules', e.target.value)}
                placeholder="Enter any local rules, course description, or special notes..."
                rows={3}
                maxLength={5000}
              />
            </div>
          </div>
        </Card>

        {/* Geographic Information */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="h-5 w-5" />
            <h2 className="text-xl font-semibold">Geographic Information</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="latitude">Latitude</Label>
              <Input
                id="latitude"
                value={formData.latitude}
                onChange={(e) => handleInputChange('latitude', e.target.value)}
                placeholder="e.g., 36.5694"
                type="number"
                step="any"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="longitude">Longitude</Label>
              <Input
                id="longitude"
                value={formData.longitude}
                onChange={(e) => handleInputChange('longitude', e.target.value)}
                placeholder="e.g., -121.9552"
                type="number"
                step="any"
              />
            </div>
          </div>
          
          <p className="text-sm text-muted-foreground mt-2">
            Optional: Add coordinates for map integration and precise location
          </p>
        </Card>

        {/* Advanced Options */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              <h2 className="text-xl font-semibold">Historical Information</h2>
            </div>
            <Button
              variant="ghost"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              {showAdvanced ? 'Hide' : 'Show'} Advanced Options
            </Button>
          </div>
          
          {showAdvanced && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="architect">Course Architect</Label>
                <Input
                  id="architect"
                  value={formData.architect}
                  onChange={(e) => handleInputChange('architect', e.target.value)}
                  placeholder="e.g., Jack Nicklaus"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="yearBuilt">Year Built</Label>
                <Input
                  id="yearBuilt"
                  value={formData.yearBuilt}
                  onChange={(e) => handleInputChange('yearBuilt', e.target.value)}
                  placeholder="e.g., 1995"
                  type="number"
                  min="1800"
                  max={new Date().getFullYear()}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="courseRecord">Course Record</Label>
                <Input
                  id="courseRecord"
                  value={formData.courseRecord}
                  onChange={(e) => handleInputChange('courseRecord', e.target.value)}
                  placeholder="e.g., 62"
                  type="number"
                  min="1"
                  max="200"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="courseRecordHolder">Record Holder</Label>
                <Input
                  id="courseRecordHolder"
                  value={formData.courseRecordHolder}
                  onChange={(e) => handleInputChange('courseRecordHolder', e.target.value)}
                  placeholder="Player name"
                />
              </div>
            </div>
          )}
        </Card>

        {/* Form Actions */}
        <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          
          <Button
            variant="secondary"
            onClick={() => handleSubmit('draft')}
            disabled={isSubmitting || !formData.name.trim()}
          >
            Save as Draft
          </Button>
          
          <Button
            onClick={() => handleSubmit('save')}
            disabled={isSubmitting || !formData.name.trim()}
          >
            {isSubmitting ? 'Creating...' : 'Save Course'}
          </Button>
          
          <Button
            onClick={() => handleSubmit('saveAndAddHoles')}
            disabled={isSubmitting || !formData.name.trim()}
            className="bg-primary"
          >
            Save & Add Holes
          </Button>
        </div>
      </div>
    </div>
  )
}