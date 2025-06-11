import Link from "next/link";
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { currentUser, auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function Home() {
  const user = await currentUser();
  const { userId } = await auth();

  // If user is signed in, redirect to the app layout which will handle league detection
  if (userId) {
    redirect('/app');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">The Bogey Club</h1>
            <SignedIn>
              <UserButton />
            </SignedIn>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <SignedOut>
          <div className="text-center">
            <h2 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
              Welcome to The Bogey Club
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              Your comprehensive golf league management platform
            </p>
            <div className="mt-8 flex justify-center gap-4">
              <Link
                href="/sign-in"
                className="rounded-md bg-green-600 px-6 py-3 text-base font-medium text-white hover:bg-green-700"
              >
                Sign In
              </Link>
              <Link
                href="/sign-up"
                className="rounded-md bg-gray-200 px-6 py-3 text-base font-medium text-gray-900 hover:bg-gray-300"
              >
                Sign Up
              </Link>
            </div>
            <div className="mt-16 grid gap-8 sm:grid-cols-3">
              <div className="rounded-lg bg-white p-6 shadow">
                <h3 className="text-lg font-semibold text-gray-900">Tournament Management</h3>
                <p className="mt-2 text-gray-600">
                  Organize and manage tournaments with multiple formats including POTY events and match play
                </p>
              </div>
              <div className="rounded-lg bg-white p-6 shadow">
                <h3 className="text-lg font-semibold text-gray-900">Live Money Games</h3>
                <p className="mt-2 text-gray-600">
                  Real-time scoring for money games with automatic calculations and live updates
                </p>
              </div>
              <div className="rounded-lg bg-white p-6 shadow">
                <h3 className="text-lg font-semibold text-gray-900">Handicap System</h3>
                <p className="mt-2 text-gray-600">
                  Automated handicap calculations following USGA/WHS rules with visual tracking
                </p>
              </div>
            </div>
          </div>
        </SignedOut>

        <SignedIn>
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900">
              Welcome back, {user?.firstName ?? "Golfer"}!
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              Ready to hit the links? Let&apos;s get you set up with a league.
            </p>
            <div className="mt-8 flex justify-center gap-4">
              <Link href="/leagues/new">
                <button className="rounded-md bg-green-600 px-6 py-3 text-base font-medium text-white hover:bg-green-700">
                  Create a League
                </button>
              </Link>
              <Link href="/leagues/join">
                <button className="rounded-md bg-gray-200 px-6 py-3 text-base font-medium text-gray-900 hover:bg-gray-300">
                  Join a League
                </button>
              </Link>
            </div>
            <div className="mt-12 rounded-lg bg-white p-8 shadow">
              <p className="text-gray-600">
                You haven&apos;t joined any leagues yet. Create your own league or join an existing one to get started!
              </p>
            </div>
          </div>
        </SignedIn>
      </main>
    </div>
  );
}