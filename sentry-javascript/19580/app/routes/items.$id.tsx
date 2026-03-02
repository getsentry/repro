import { Link, useParams, useSearchParams } from "react-router";

export default function ItemDetail() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || "/";

  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>Item {id}</h1>
      <p>redirectTo: {redirectTo}</p>
      <p>
        <Link to="/">Back to home</Link>
      </p>
    </div>
  );
}
