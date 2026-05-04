import LoginForm from "../../../components/auth/LoginForm";

export default function LoginPage() {
  return (
    <main className="flex h-screen items-center justify-center bg-gradient-to-br from-gray-900 via-blue-900 to-black">
      <div className="w-full max-w-md">
        <LoginForm />
      </div>
    </main>
  );
}