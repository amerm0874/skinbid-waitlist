import type { Metadata } from "next";
import { ProductNav } from "@/components/product/ProductNav";
import LoginForm from "./LoginForm";

export const metadata: Metadata = {
  title: "Log in",
};

export default function LoginPage() {
  return (
    <div className="min-h-full bg-bg">
      <ProductNav />
      <main className="site-wrap py-12">
        <h1 className="display text-[40px]">Log in</h1>
        <p className="mt-2 max-w-sm text-[14px] text-muted">
          We email a link. No password. After that you pick athlete or brand.
        </p>
        <div className="mt-8">
          <LoginForm />
        </div>
      </main>
    </div>
  );
}
