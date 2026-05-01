"use client";

interface Props {
  priceId: string;
  className?: string;
  children: React.ReactNode;
}

export default function PaddleCheckoutButton({ priceId, className, children }: Props) {
  const handleClick = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).Paddle?.Checkout.open({
      items: [{ priceId, quantity: 1 }],
    });
  };

  return (
    <button onClick={handleClick} className={className}>
      {children}
    </button>
  );
}
