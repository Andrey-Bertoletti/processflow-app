import LoginForm from "../../../components/auth/LoginForm";

export default function LoginPage() {
  return (
    <main className="app-shell flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <LoginForm />
      </div>
    </main>
  );
}