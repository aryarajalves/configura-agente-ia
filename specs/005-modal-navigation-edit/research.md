# Research: Metadata Management and Modal Navigation

## JSON Visualization in React

- **Decision**: Use a `<pre>` tag with Tailwind CSS for formatted JSON display.
- **Rationale**: Minimal overhead compared to dedicated libraries like `react-json-view`, fully customizable styling, and consistent with the project's performance principles.
- **Alternatives Considered**: 
  - `react-json-view`: Rejected to avoid unnecessary dependency bloat.
  - Custom recursive component: Rejected as a simple formatted string in a `<pre>` tag is sufficient for "read-only" JSON visualization.

## Dynamic Key-Value Editor

- **Decision**: Implement a controlled state using an array of objects `[{ key: string, value: any }]`.
- **Rationale**: Storing as an array (instead of a direct object) allows for duplicate keys during editing (preventing data loss while typing) and makes it trivial to rename keys.
- **Alternatives Considered**:
  - Direct object state: Rejected because renaming a key in a JavaScript object is cumbersome and can cause cursor jumping in inputs.

## Gallery-Style Navigation

- **Decision**: Use `Lucide React` icons (`ChevronLeft`, `ChevronRight`) inside buttons with `fixed` or `absolute` positioning on the modal sides.
- **Rationale**: Matches the "gallery" feel requested by the user. Semi-transparent backgrounds (`bg-white/10` or `bg-black/20`) ensure visibility over various content types.
- **Alternatives Considered**:
  - Footer buttons: Rejected per user preference for side-navigation.

## Integration Pattern for Metadata Persistence

- **Decision**: Convert the `{key, value}` array back into a standard JSON object before sending the `PUT` request to the API.
- **Rationale**: Maintains compatibility with existing backend schemas while providing a flexible frontend editing experience.
