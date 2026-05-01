"use client";
import { usePaddle } from "./PaddleProvider";

interface Props {
  priceId: string;
  className?: string;
  children: React.ReactNode;
}

export default function PaddleCheckoutButton({ priceId, className, children }: Props) {
  const paddle = usePaddle();

  const handleClick = () => {
    paddle?.Checkout.open({
      items: [{ priceId, quantity: 1 }],
    });
  };

  return (
    <button onClick={handleClick} className={className}>
      {children}
    </button>
  );
}
