"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const formSchema = z.object({
  handicapIndex: z
    .number()
    .min(0, {
      message: "Handicap index must be at least 0.",
    })
    .max(54, {
      message: "Handicap index cannot exceed 54.",
    }),
  homeClub: z
    .string()
    .min(2, {
      message: "Home club name must be at least 2 characters.",
    })
    .max(100, {
      message: "Home club name must not exceed 100 characters.",
    })
    .transform((val) => val.trim()),
  phoneNumber: z
    .string()
    .optional()
    .refine(
      (val) => {
        if (!val || val.trim() === "") return true;
        // Basic phone validation - adjust regex as needed
        return /^[\+]?[\d\s\-\(\)]{10,}$/.test(val.trim());
      },
      {
        message: "Please enter a valid phone number.",
      }
    )
    .transform((val) => val?.trim() || undefined),
});

export default function OnboardingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leagueId, setLeagueId] = useState<string | null>(null);

  // Get leagueId from URL params
  useEffect(() => {
    const leagueIdParam = searchParams.get("leagueId");
    if (!leagueIdParam) {
      // If no leagueId provided, redirect to home
      router.push("/");
      return;
    }
    setLeagueId(leagueIdParam);
  }, [searchParams, router]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      handicapIndex: 54, // Default to maximum handicap
      homeClub: "",
      phoneNumber: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!leagueId) {
      setError("No league selected. Please try again.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...values,
          leagueId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to complete onboarding");
      }

      // Redirect to league dashboard
      router.push(data.redirectUrl || `/leagues/${leagueId}/dashboard`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!leagueId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
        {/* Progress Indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-center">
            <div className="flex items-center space-x-4">
              <div className="flex items-center justify-center w-8 h-8 bg-green-600 text-white rounded-full text-sm font-medium">
                ✓
              </div>
              <div className="w-16 h-1 bg-green-600"></div>
              <div className="flex items-center justify-center w-8 h-8 bg-green-600 text-white rounded-full text-sm font-medium">
                ✓
              </div>
              <div className="w-16 h-1 bg-green-600"></div>
              <div className="flex items-center justify-center w-8 h-8 bg-blue-600 text-white rounded-full text-sm font-medium">
                3
              </div>
            </div>
          </div>
          <div className="mt-2 text-center">
            <p className="text-sm text-gray-600">Complete Your Golf Profile</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Welcome to The Bogey Club!</CardTitle>
            <CardDescription>
              Help us personalize your experience with some golf-specific details. 
              This information will be used for handicap calculations and tournament management.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="handicapIndex"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Initial Handicap Index</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.1"
                          min="0"
                          max="54"
                          placeholder="e.g., 12.5"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          disabled={isSubmitting}
                        />
                      </FormControl>
                      <FormDescription>
                        Enter your current handicap index (0-54). If you don't have an official handicap, enter 54.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="homeClub"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Home Club</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., Pine Valley Golf Club"
                          {...field}
                          disabled={isSubmitting}
                        />
                      </FormControl>
                      <FormDescription>
                        The golf club where you primarily play or hold membership.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phoneNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          type="tel"
                          placeholder="e.g., +1 (555) 123-4567"
                          {...field}
                          disabled={isSubmitting}
                        />
                      </FormControl>
                      <FormDescription>
                        Used for tournament notifications and league communications. You can skip this for now.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {error && (
                  <div className="rounded-md bg-red-50 p-4">
                    <p className="text-sm text-red-800">{error}</p>
                  </div>
                )}

                <div className="flex gap-4">
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1"
                  >
                    {isSubmitting ? "Completing Setup..." : "Complete Setup"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.back()}
                    disabled={isSubmitting}
                  >
                    Back
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}