import RegisterForm from "../../../components/auth/RegisterForm";

export default function RegisterPage() {
  return (
    <main className="flex h-screen items-center justify-center bg-gradient-to-br from-gray-900 via-blue-900 to-black">
      <div className="w-full max-w-md">
        <RegisterForm />
      </div>
    </main>
  );
}
