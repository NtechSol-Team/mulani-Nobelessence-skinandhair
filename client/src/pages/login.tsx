import { Link } from "wouter";

export default function Login() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center">
        <h2 className="text-2xl font-semibold">Login Disabled</h2>
        <p className="mt-2">Authentication has been removed. Use the application directly.</p>
        <div className="mt-4">
          <Link href="/">
            <a className="text-primary">Go to Dashboard</a>
          </Link>
        </div>
      </div>
    </div>
  );
}
