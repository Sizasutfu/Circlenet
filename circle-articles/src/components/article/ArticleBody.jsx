export default function ArticleBody({ content }) {
  return (
    <div
      className="art-body"
      dangerouslySetInnerHTML={{ __html: content || '<p>No content available.</p>' }}
    />
  );
}