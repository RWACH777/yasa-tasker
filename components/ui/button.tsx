import * as React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

export function Button({ className = "", ...props }: ButtonProps) {
  return (
    <button
      className={px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition ${className}}
      {...props}
    />
  );
}