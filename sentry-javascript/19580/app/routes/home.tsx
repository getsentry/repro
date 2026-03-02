import { Link } from "react-router";

export default function Home() {
  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>Reproduction: sentry-javascript#19580</h1>
      <p>
        <code>reactRouterTracingIntegration</code> produces{" "}
        <code>[object Object]</code> as transaction name when navigating with an
        object <code>to</code> prop.
      </p>

      <h2>Navigate with string (works correctly)</h2>
      <p>
        <Link to="/items/1?redirectTo=%2F">
          Link with string to="/items/1?redirectTo=%2F"
        </Link>
      </p>

      <h2>Navigate with object (BUG: transaction name is [object Object])</h2>
      <p>
        <Link
          to={{
            pathname: "/items/2",
            search: `redirectTo=${encodeURIComponent("/")}`,
          }}
        >
          Link with object to=&#123;&#123; pathname: "/items/2", search: "..." &#125;&#125;
        </Link>
      </p>
    </div>
  );
}
