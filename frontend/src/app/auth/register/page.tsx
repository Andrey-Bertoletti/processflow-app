import RegisterForm from "../../../components/auth/RegisterForm";

export default function RegisterPage() {
  return (
    <main className="app-shell flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <RegisterForm />
      </div>
    </main>
  );
}
