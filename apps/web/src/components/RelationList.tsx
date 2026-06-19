type Relation = {
  id: number;
  relation_type: string;
  target_work_id: string;
  target_title: string;
  note: string | null;
};

type RelationListProps = {
  relations: Relation[];
};

export function RelationList({ relations }: RelationListProps) {
  if (relations.length === 0) return <p className="muted">暂无关联作品。</p>;

  const groups = relations.reduce<Record<string, Relation[]>>((acc, relation) => {
    acc[relation.relation_type] = acc[relation.relation_type] ?? [];
    acc[relation.relation_type].push(relation);
    return acc;
  }, {});

  return (
    <div>
      {Object.entries(groups).map(([type, items]) => (
        <section key={type}>
          <h3>{type}</h3>
          {items.map((item) => (
            <article className="work-card" key={item.id}>
              <strong>{item.target_title}</strong>
              {item.note ? <p>{item.note}</p> : null}
            </article>
          ))}
        </section>
      ))}
    </div>
  );
}
