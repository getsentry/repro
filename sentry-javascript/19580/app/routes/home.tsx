import { Link, useNavigate } from "react-router";

export default function Home() {
  const navigate = useNavigate();

  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>Reproduction: sentry-javascript#19580</h1>
      <p>
        <code>reactRouterTracingIntegration</code> uses <code>String(args[0])</code> for
        the transaction name. When <code>navigate(to)</code> is called with an object{" "}
        <code>to</code>, that becomes <code>[object Object]</code>.
      </p>
      <p>
        <strong>Open the browser console</strong> and look for{" "}
        <code>[Sentry Transaction] name: "..."</code> — when you navigate with an
        object, the name should be <code>[object Object]</code> (the bug).
      </p>

      <h2>1. Navigate with string (correct name)</h2>
      <p>
        <Link to="/items/1?redirectTo=%2F">
          Link with string <code>to="/items/1?redirectTo=%2F"</code>
        </Link>
      </p>

      <h2>2. Navigate with object – Link (bug)</h2>
      <p>
        <Link
          to={{
            pathname: "/items/2",
            search: `redirectTo=${encodeURIComponent("/")}`,
          }}
        >
          Link with object <code>to=&#123;&#123; pathname, search &#125;&#125;</code>
        </Link>
      </p>

      <h2>3. Navigate with object – programmatic (bug; most reliable)</h2>
      <p>
        This calls <code>navigate(&#123; pathname, search &#125;)</code> directly, so
        the router receives the object and Sentry does <code>String(args[0])</code>.
      </p>
      <p>
        <button
          type="button"
          onClick={() =>
            navigate({
              pathname: "/items/3",
              search: `redirectTo=${encodeURIComponent("/")}`,
            })
          }
        >
          navigate(&#123; pathname: "/items/3", search: "..." &#125;)
        </button>
      </p>
    </div>
  );
}
