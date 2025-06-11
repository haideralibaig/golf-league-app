"use client"

import { useState, use, useEffect } from 'react'
import { Search, Plus, MapPin, Calendar, User, Building } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'

interface Course {
  id: string
  name: string
  location?: string
  holeCount: number
  architect?: string
  yearBuilt?: number
  isOfficial: boolean
  courseRecord?: number
  courseRecordHolder?: string
}

// API response interface
interface ApiResponse {
  courses: Course[]
  total: number
  filters: {
    type: string
    search: string
    holeCount: number | null
  }
}

interface CourseListPageProps {
  params: Promise<{
    leagueId: string
    chapterId: string
  }>
}

export default function CourseListPage({ params }: CourseListPageProps) {
  const { leagueId, chapterId } = use(params)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState('official')
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch courses from API
  const fetchCourses = async (type: 'official' | 'custom' | 'all' = 'all') => {
    try {
      setLoading(true)
      setError(null)
      
      const queryParams = new URLSearchParams({
        type,
        ...(searchTerm && { search: searchTerm })
      })
      
      const response = await fetch(`/api/leagues/${leagueId}/courses?${queryParams}`)
      
      if (!response.ok) {
        throw new Error(`Failed to fetch courses: ${response.statusText}`)
      }
      
      const data: ApiResponse = await response.json()
      setCourses(data.courses)
    } catch (err) {
      console.error('Error fetching courses:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch courses')
    } finally {
      setLoading(false)
    }
  }

  // Fetch courses on component mount and when search/tab changes
  useEffect(() => {
    fetchCourses(activeTab === 'official' ? 'official' : 'custom')
  }, [leagueId, activeTab])

  // Debounced search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchCourses(activeTab === 'official' ? 'official' : 'custom')
    }, 300)
    
    return () => clearTimeout(timeoutId)
  }, [searchTerm])

  // Filter courses by tab
  const filteredOfficialCourses = courses.filter(course => course.isOfficial)
  const filteredLeagueCourses = courses.filter(course => !course.isOfficial)

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold">Course Management</h1>
          <p className="text-muted-foreground">Manage courses for your league</p>
        </div>
        <Link href={`/leagues/${leagueId}/chapters/${chapterId}/courses/new`}>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add New Course
          </Button>
        </Link>
      </div>

      {/* Search Bar */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          placeholder="Search courses by name or location..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="official">Official Courses</TabsTrigger>
          <TabsTrigger value="league">Our Courses</TabsTrigger>
        </TabsList>

        {/* Official Courses Tab */}
        <TabsContent value="official" className="mt-6">
          <div className="mb-4">
            <h2 className="text-xl font-semibold">Master Course Database</h2>
            <p className="text-muted-foreground">Import courses from our official database</p>
          </div>
          
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
              Error: {error}
            </div>
          )}
          
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading courses...
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredOfficialCourses.map((course) => (
                  <CourseCard 
                    key={course.id} 
                    course={course} 
                    type="official"
                    leagueId={leagueId}
                    chapterId={chapterId}
                  />
                ))}
              </div>
              
              {filteredOfficialCourses.length === 0 && !loading && (
                <div className="text-center py-8 text-muted-foreground">
                  No official courses found matching your search.
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* League Courses Tab */}
        <TabsContent value="league" className="mt-6">
          <div className="mb-4">
            <h2 className="text-xl font-semibold">League Courses</h2>
            <p className="text-muted-foreground">Courses specific to your league</p>
          </div>
          
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
              Error: {error}
            </div>
          )}
          
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading courses...
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredLeagueCourses.map((course) => (
                  <CourseCard 
                    key={course.id} 
                    course={course} 
                    type="league"
                    leagueId={leagueId}
                    chapterId={chapterId}
                  />
                ))}
              </div>
              
              {filteredLeagueCourses.length === 0 && !loading && (
                <div className="text-center py-8 text-muted-foreground">
                  No league courses found. Create your first course to get started.
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

interface CourseCardProps {
  course: Course
  type: 'official' | 'league'
  leagueId: string
  chapterId: string
}

function CourseCard({ course, type, leagueId, chapterId }: CourseCardProps) {
  const handleImport = () => {
    // TODO: Implement import functionality
    console.log('Importing course:', course.id)
  }

  const handleEdit = () => {
    window.location.href = `/leagues/${leagueId}/chapters/${chapterId}/courses/${course.id}/edit`
  }

  const handleDelete = () => {
    // TODO: Implement delete functionality
    console.log('Deleting course:', course.id)
  }

  return (
    <Card className="p-4 hover:shadow-md transition-shadow">
      <div className="space-y-3">
        {/* Header */}
        <div className="flex justify-between items-start">
          <h3 className="font-semibold text-lg leading-tight">{course.name}</h3>
          {course.isOfficial && (
            <Badge variant="secondary">Official</Badge>
          )}
        </div>

        {/* Location */}
        {course.location && (
          <div className="flex items-center text-sm text-muted-foreground gap-1">
            <MapPin className="h-5 w-5 flex-shrink-0" />
            <span>{course.location}</span>
          </div>
        )}

        {/* Course Details */}
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Holes:</span>
            <span>{course.holeCount}</span>
          </div>
          
          {course.architect && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Architect:</span>
              <span className="text-right">{course.architect}</span>
            </div>
          )}
          
          {course.yearBuilt && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Built:</span>
              <span>{course.yearBuilt}</span>
            </div>
          )}
          
          {course.courseRecord && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Record:</span>
              <span>{course.courseRecord} {course.courseRecordHolder ? `(${course.courseRecordHolder})` : ''}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          {type === 'official' ? (
            <Button 
              onClick={handleImport} 
              className="flex-1" 
              size="sm"
            >
              Import Course
            </Button>
          ) : (
            <>
              <Button 
                onClick={handleEdit} 
                variant="outline" 
                size="sm" 
                className="flex-1"
              >
                Edit
              </Button>
              <Button 
                onClick={handleDelete} 
                variant="destructive" 
                size="sm"
              >
                Delete
              </Button>
            </>
          )}
        </div>
      </div>
    </Card>
  )
}