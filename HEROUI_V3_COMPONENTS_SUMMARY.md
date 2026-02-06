# HeroUI v3 Components - Comprehensive Summary

## Overview
**Version:** 3.0.0-beta.5  
**Status:** Beta (expect breaking changes)  
**Built on:** React Aria Components, Tailwind CSS v4  
**Architecture:** Compound components pattern, BEM methodology

---

## All Available Components by Category

### Buttons (3 components)
- **Button** - Clickable button with multiple variants and states
- **ButtonGroup** - Group related buttons together
- **CloseButton** - Button for closing dialogs/modals

### Forms (20 components)
- **Checkbox** - Individual checkbox control
- **CheckboxGroup** - Group of checkboxes
- **ComboBox** - Autocomplete with dropdown
- **DateField** - Date input field
- **Description** - Helper text component
- **ErrorMessage** - Error message display
- **FieldError** - Validation error message
- **Fieldset** - Group related form fields
- **Form** - Form wrapper for validation
- **Input** - Primitive single-line text input
- **InputGroup** - Input with prefix/suffix
- **InputOTP** - OTP input field
- **Label** - Form field label
- **NumberField** - Number input with increment/decrement
- **RadioGroup** - Radio button group
- **SearchField** - Search input with clear button
- **Select** - Dropdown select component
- **Switch** - Toggle switch component
- **TextField** - Composition-friendly text field wrapper
- **TextArea** - Multiline text input
- **TimeField** - Time input field

### Navigation (6 components)
- **Accordion** - Collapsible content panels
- **Breadcrumbs** - Navigation breadcrumbs
- **Disclosure** - Single collapsible panel
- **DisclosureGroup** - Group of disclosures
- **Link** - Link component
- **Tabs** - Tab navigation component

### Overlays (4 components)
- **AlertDialog** - Alert dialog modal
- **Modal** - Dialog overlay for focused interactions
- **Popover** - Rich content in portal
- **Tooltip** - Tooltip component

### Collections (3 components)
- **Dropdown** - Dropdown menu
- **ListBox** - List of selectable options
- **TagGroup** - Focusable list of tags

### Controls (2 components)
- **Slider** - Range slider control
- **Switch** - Toggle switch (also in Forms)

### Feedback (3 components)
- **Alert** - Alert messages
- **Skeleton** - Loading placeholder
- **Spinner** - Loading indicator

### Layout (3 components)
- **Card** - Flexible container component
- **Separator** - Visual divider
- **Surface** - Surface-level styling container

### Media (1 component)
- **Avatar** - User profile image display

### Pickers (3 components)
- **Autocomplete** - Autocomplete with filtering
- **ComboBox** - Combo box picker (also in Forms)
- **Select** - Select picker (also in Forms)

### Typography (1 component)
- **Kbd** - Keyboard key display

### Data Display (1 component)
- **Chip** - Informational badges

### Utilities (1 component)
- **ScrollShadow** - Visual scroll indicators

**Total: 60+ components**

---

## Key Components for Migration - Detailed Props & Variants

### 1. Button
**Variants:** `primary`, `secondary`, `tertiary`, `outline`, `ghost`, `danger`  
**Sizes:** `sm`, `md`, `lg`  
**Key Props:**
- `variant` - Visual style variant (default: `'primary'`)
- `size` - Size of button (default: `'md'`)
- `fullWidth` - Full width container
- `isDisabled` - Disabled state
- `isPending` - Loading state
- `isIconOnly` - Icon-only button
- `onPress` - Press handler

**Special Features:**
- Supports render props for state access
- Loading state with Spinner integration
- Icon support (with icons or icon-only)
- Ripple effect support via composition

### 2. Input
**Variants:** `primary` (default, with shadow), `secondary` (lower emphasis, no shadow)  
**Key Props:**
- `type` - Input type (text, email, password, etc.)
- `variant` - Visual variant
- `fullWidth` - Full width container
- `disabled`, `readOnly`, `required` - Standard HTML attributes
- All standard HTML input attributes supported

**Note:** For validation, labels, and error messages, use **TextField** wrapper component.

### 3. TextField
**Composition Component** - Wraps Input/TextArea with Label, Description, FieldError

**Key Props:**
- `isRequired` - Required field
- `isInvalid` - Invalid state
- `isDisabled` - Disabled state
- `validate` - Custom validation function
- `validationBehavior` - `'native'` or `'aria'`
- `value`, `defaultValue`, `onChange` - Value management

**Composition Components:**
- `TextField.Label` - Field label
- `TextField.Input` - Single-line input (or use `Input` component)
- `TextField.TextArea` - Multiline input (or use `TextArea` component)
- `TextField.Description` - Helper text
- `TextField.FieldError` - Error message

**Best Practice:** Use TextField for complete form fields with validation.

### 4. TextArea
**Key Props:**
- `rows` - Number of visible lines (default: `3`)
- `fullWidth` - Full width container
- `isOnSurface` - Surface styling variant
- All standard HTML textarea attributes

**Note:** Use within TextField for validation support.

### 5. Checkbox
**Variants:** `primary` (default), `secondary` (for surfaces)  
**Key Props:**
- `isSelected` - Checked state (controlled)
- `defaultSelected` - Default checked (uncontrolled)
- `isIndeterminate` - Indeterminate state
- `isDisabled`, `isInvalid`, `isReadOnly` - State props
- `variant` - Visual variant
- `onChange` - Change handler

**Composition:**
- `Checkbox.Control` - Checkbox control box
- `Checkbox.Indicator` - Checkmark indicator
- `Checkbox.Content` - Content wrapper (Label, Description)

### 6. Switch
**Sizes:** `sm`, `md`, `lg`  
**Key Props:**
- `size` - Switch size (default: `'md'`)
- `isSelected` - On state (controlled)
- `defaultSelected` - Default on state (uncontrolled)
- `isDisabled` - Disabled state
- `onChange` - Change handler

**Composition:**
- `Switch.Control` - Switch track
- `Switch.Thumb` - Moving thumb
- `Switch.Icon` - Optional icon inside thumb
- `SwitchGroup` - Group multiple switches

### 7. RadioGroup
**Variants:** `primary` (default), `secondary` (for surfaces)  
**Key Props:**
- `value` - Selected value (controlled)
- `defaultValue` - Default value (uncontrolled)
- `onChange` - Selection change handler
- `isDisabled`, `isRequired`, `isInvalid` - State props
- `variant` - Visual variant
- `orientation` - `'horizontal'` or `'vertical'` (default: `'vertical'`)

**Composition:**
- `RadioGroup.Label` - Group label
- `RadioGroup.Description` - Group description
- `RadioGroup.Radio` - Individual radio button
  - `Radio.Control` - Radio control circle
  - `Radio.Indicator` - Inner dot indicator
  - `Radio.Content` - Content wrapper

### 8. Select
**Variants:** `primary` (default, with shadow), `secondary` (for surfaces)  
**Key Props:**
- `placeholder` - Placeholder text
- `selectionMode` - `'single'` or `'multiple'`
- `value`, `defaultValue` - Selected value(s)
- `onChange` - Selection change handler
- `isOpen`, `defaultOpen`, `onOpenChange` - Open state
- `disabledKeys` - Disabled option keys
- `isDisabled`, `isRequired`, `isInvalid` - State props
- `variant` - Visual variant
- `fullWidth` - Full width container

**Composition:**
- `Select.Label` - Field label
- `Select.Trigger` - Trigger button
- `Select.Value` - Displayed value
- `Select.Indicator` - Dropdown icon
- `Select.Popover` - Popover container
- `Select.ListBox` - Options list (uses ListBox component)

### 9. Card
**Variants:** `transparent`, `default`, `secondary`, `tertiary`  
**Key Props:**
- `variant` - Semantic prominence level (default: `'default'`)

**Composition:**
- `Card.Header` - Header section
- `Card.Title` - Title (renders as h3)
- `Card.Description` - Description (renders as p)
- `Card.Content` - Main content
- `Card.Footer` - Footer section

**Variants Explained:**
- `transparent` - Minimal prominence, transparent background
- `default` - Standard card (bg-surface-secondary)
- `secondary` - Medium prominence (bg-surface-tertiary)
- `tertiary` - Higher prominence (bg-surface-tertiary)

### 10. Modal (Dialog)
**Backdrop Variants:** `opaque` (default), `blur`, `transparent`  
**Sizes:** `xs`, `sm`, `md`, `lg`, `cover`, `full`  
**Placement:** `auto` (default), `top`, `center`, `bottom`  
**Scroll:** `inside` (default), `outside`

**Key Props:**
- `isDismissable` - Close on backdrop click (default: `true`)
- `isKeyboardDismissDisabled` - Disable ESC key (default: `false`)
- `isOpen`, `defaultOpen`, `onOpenChange` - Open state
- `placement` - Modal position
- `size` - Modal size
- `scroll` - Scroll behavior

**Composition:**
- `Modal.Trigger` - Trigger element
- `Modal.Backdrop` - Overlay backdrop
- `Modal.Container` - Positioning wrapper
- `Modal.Dialog` - Content container
- `Modal.Header` - Header section
- `Modal.Heading` - Heading text
- `Modal.Body` - Main content
- `Modal.Footer` - Footer section
- `Modal.CloseTrigger` - Close button

**Special:** Use `slot="close"` on Button to auto-close modal.

### 11. Popover
**Placement:** `top`, `bottom`, `left`, `right` (and variants)  
**Key Props:**
- `isOpen`, `defaultOpen`, `onOpenChange` - Open state
- `placement` - Popover position (default: `'bottom'`)
- `offset` - Distance from trigger (default: `8`)
- `shouldFlip` - Auto-flip to fit (default: `true`)

**Composition:**
- `Popover.Trigger` - Trigger element
- `Popover.Content` - Content wrapper
- `Popover.Dialog` - Dialog content
- `Popover.Heading` - Heading text
- `Popover.Arrow` - Optional arrow indicator

### 12. Tabs
**Variants:** `primary` (default, filled indicator), `secondary` (underline indicator)  
**Orientation:** `horizontal` (default), `vertical`  
**Key Props:**
- `variant` - Visual style variant
- `orientation` - Tab layout
- `hideSeparator` - Hide separator lines
- `selectedKey`, `defaultSelectedKey` - Selected tab
- `onSelectionChange` - Selection handler

**Composition:**
- `Tabs.ListContainer` - List container wrapper
- `Tabs.List` - Tab list
- `Tabs.Tab` - Individual tab button
- `Tabs.Indicator` - Tab indicator
- `Tabs.Panel` - Tab panel content

### 13. Accordion
**Variants:** `default`, `surface`  
**Key Props:**
- `allowsMultipleExpanded` - Multiple items open (default: `false`)
- `expandedKeys`, `defaultExpandedKeys` - Expanded items
- `onExpandedChange` - Expansion handler
- `isDisabled` - Disable entire accordion
- `variant` - Visual variant
- `hideSeparator` - Hide separator lines

**Composition:**
- `Accordion.Item` - Individual accordion item
- `Accordion.Heading` - Heading wrapper
- `Accordion.Trigger` - Clickable trigger
- `Accordion.Indicator` - Expand/collapse icon
- `Accordion.Panel` - Collapsible panel
- `Accordion.Body` - Content body

### 14. Avatar
**Sizes:** `sm`, `md`, `lg`  
**Colors:** `default`, `accent`, `success`, `warning`, `danger`  
**Variants:** `default`, `soft`  
**Key Props:**
- `size` - Avatar size (default: `'md'`)
- `color` - Fallback color theme
- `variant` - Visual style variant

**Composition:**
- `Avatar.Image` - Profile image
- `Avatar.Fallback` - Fallback content (letters, icon, etc.)

**Special:** Supports Avatar.Group for multiple avatars.

### 15. Chip
**Variants:** `primary`, `secondary`, `tertiary`, `soft`  
**Colors:** `default`, `accent`, `success`, `warning`, `danger`  
**Sizes:** `sm`, `md`, `lg`  
**Key Props:**
- `variant` - Visual style variant (default: `'secondary'`)
- `color` - Color variant (default: `'default'`)
- `size` - Size (default: `'md'`)

**Compound Variants:** Supports combining variant + color (e.g., `primary.accent`, `soft.success`)

### 16. Spinner
**Sizes:** `sm`, `md`, `lg`, `xl`  
**Colors:** `current`, `accent`, `success`, `warning`, `danger`  
**Key Props:**
- `size` - Spinner size (default: `'md'`)
- `color` - Color variant (default: `'current'`)

### 17. Skeleton
**Animation Types:** `shimmer` (default), `pulse`, `none`  
**Key Props:**
- `animationType` - Animation type (can be set via CSS variable `--skeleton-animation`)

**Special:** Supports synchronized shimmer effect across multiple skeletons via parent `.skeleton--shimmer` class.

---

## RTL & Dark Mode Support

### Dark Mode
**Built-in Support:** Yes, via theming system

**Implementation:**
```html
<!-- Light theme -->
<html class="light" data-theme="light">

<!-- Dark theme -->
<html class="dark" data-theme="dark">
```

**Theme Variables:**
- Colors automatically switch between light/dark themes
- Uses semantic naming: `--accent` (background), `--accent-foreground` (text)
- CSS variables defined for both themes
- Components automatically adapt to theme

**Customization:**
```css
:root {
  --accent: oklch(0.7 0.25 260);
  --success: oklch(0.65 0.15 155);
}

.dark {
  --accent: oklch(0.7 0.12 210);
  --success: oklch(0.7 0.15 155);
}
```

### RTL Support
**Status:** Not explicitly documented in fetched documentation  
**Note:** React Aria Components (which HeroUI v3 is built on) provides RTL support, but specific HeroUI RTL documentation was not found in the search results. Components should inherit RTL support from React Aria.

---

## Form Components Best Practices

### 1. Use TextField for Complete Form Fields
**Recommended Pattern:**
```tsx
<TextField isRequired isInvalid={hasError} name="email">
  <Label>Email Address</Label>
  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
  <Description>We'll never share your email.</Description>
  <FieldError>Please enter a valid email address.</FieldError>
</TextField>
```

**Benefits:**
- Automatic accessibility (ARIA attributes)
- Validation state management
- Consistent layout
- Error message handling

### 2. Form Validation
**Use Form Component:**
```tsx
<Form onSubmit={handleSubmit} validationErrors={serverErrors}>
  <TextField isRequired name="username">
    <Label>Username</Label>
    <Input />
    <FieldError />
  </TextField>
  <Button type="submit">Submit</Button>
</Form>
```

**Validation Approaches:**
- `isInvalid` prop for manual validation
- `validate` function for custom validation logic
- `validationBehavior` - `'native'` (HTML5) or `'aria'` (ARIA attributes)
- Server-side errors via `validationErrors` prop

### 3. Surface Variants for Nested Forms
**When using forms inside Surface/Card components:**
```tsx
<Surface>
  <TextField>
    <Label>Name</Label>
    <Input variant="secondary" /> {/* Use secondary variant */}
  </TextField>
  <Select variant="secondary"> {/* Use secondary variant */}
    {/* options */}
  </Select>
</Surface>
```

**Components with Surface Variants:**
- Input: `variant="secondary"`
- TextArea: `isOnSurface={true}` or `variant="secondary"`
- Select: `variant="secondary"`
- Checkbox: `variant="secondary"`
- RadioGroup: `variant="secondary"`

### 4. Controlled vs Uncontrolled
**Controlled (Recommended for React):**
```tsx
const [value, setValue] = useState('');
<TextField value={value} onChange={setValue}>
  <Input />
</TextField>
```

**Uncontrolled:**
```tsx
<TextField defaultValue="initial" name="field">
  <Input />
</TextField>
```

### 5. Form Field Composition
**Best Practice Structure:**
```tsx
<TextField isRequired isInvalid={error} name="field">
  <Label>Field Label</Label>
  <Input placeholder="Enter value" />
  <Description>Helper text</Description>
  <FieldError>Error message</FieldError>
</TextField>
```

**Components Work Together:**
- `Label` - Automatically associates with input
- `Description` - Hidden when invalid (automatic)
- `FieldError` - Shown when `isInvalid={true}`
- All components share validation state

### 6. Checkbox & Switch Patterns
**Individual Checkbox:**
```tsx
<Checkbox isSelected={checked} onChange={setChecked}>
  <Checkbox.Control>
    <Checkbox.Indicator />
  </Checkbox.Control>
  <Checkbox.Content>
    <Label>Accept terms</Label>
    <Description>Optional description</Description>
  </Checkbox.Content>
</Checkbox>
```

**Switch:**
```tsx
<Switch isSelected={enabled} onChange={setEnabled}>
  <Switch.Control>
    <Switch.Thumb />
  </Switch.Control>
  <Label>Enable notifications</Label>
</Switch>
```

### 7. Select Best Practices
**Single Select:**
```tsx
<Select placeholder="Choose option" name="option">
  <Label>Select Option</Label>
  <Select.Trigger>
    <Select.Value />
    <Select.Indicator />
  </Select.Trigger>
  <Select.Popover>
    <ListBox>
      <ListBox.Item id="1" textValue="Option 1">Option 1</ListBox.Item>
      <ListBox.Item id="2" textValue="Option 2">Option 2</ListBox.Item>
    </ListBox>
  </Select.Popover>
</Select>
```

**Multiple Select:**
```tsx
<Select selectionMode="multiple" placeholder="Select items">
  {/* Same structure */}
</Select>
```

### 8. RadioGroup Pattern
```tsx
<RadioGroup value={selected} onChange={setSelected} name="plan">
  <Label>Subscription Plan</Label>
  <Description>Choose your plan</Description>
  <Radio value="basic">
    <Radio.Control>
      <Radio.Indicator />
    </Radio.Control>
    <Radio.Content>
      <Label>Basic Plan</Label>
      <Description>Includes 100 messages</Description>
    </Radio.Content>
  </Radio>
  <FieldError />
</RadioGroup>
```

### 9. Form Accessibility
**All form components:**
- Built on React Aria Components (WCAG compliant)
- Proper ARIA attributes
- Keyboard navigation support
- Screen reader announcements
- Focus management

**Required Fields:**
- Use `isRequired` prop (not HTML `required` attribute)
- Automatically adds `aria-required`
- Shows visual indicator

### 10. Error Handling
**Client-side Validation:**
```tsx
const [error, setError] = useState(false);

<TextField 
  isInvalid={error}
  validate={(value) => {
    if (value.length < 3) {
      setError(true);
      return "Must be at least 3 characters";
    }
    setError(false);
    return true;
  }}
>
  <Input />
  <FieldError />
</TextField>
```

**Server-side Validation:**
```tsx
<Form validationErrors={serverErrors}>
  <TextField name="email">
    <Input />
    <FieldError />
  </TextField>
</Form>
```

---

## Styling & Customization

### CSS Classes (BEM Methodology)
All components use BEM naming:
- Base: `.component`
- Element: `.component__element`
- Modifier: `.component--modifier`

### Customization Methods
1. **Tailwind Classes:** Pass `className` prop
2. **CSS Layers:** Use `@layer components` to override
3. **CSS Variables:** Override theme variables
4. **Custom Variants:** Wrap components and extend

### Theme Variables
- Colors: `--accent`, `--success`, `--warning`, `--danger`, etc.
- Foregrounds: `--accent-foreground`, etc.
- Surfaces: `--surface`, `--surface-secondary`, `--surface-tertiary`
- Fields: `--field-*` variables for form controls

---

## Migration Notes

### Key Differences from v2
1. **No Provider:** Components work without Provider wrapper
2. **Compound Components:** Use dot notation (e.g., `Card.Header`)
3. **Tailwind v4:** Requires Tailwind CSS v4 (not v3)
4. **React Aria:** Built on React Aria Components
5. **Composition:** More composition-friendly patterns

### Breaking Changes
- API changes from v2
- Different import paths
- New component structure
- Styling system changes

**Note:** Migration from v2 to v3 is NOT supported yet (coming when v3 is stable).

---

## Resources

- **Documentation:** https://v3.heroui.com/docs/react/components
- **Storybook:** https://storybook-v3.heroui.com
- **GitHub:** https://github.com/heroui-inc/heroui
- **Figma:** https://www.figma.com/community/file/1546526812159103429
- **Theme Builder:** https://v3.heroui.com/themes

---

*Generated from HeroUI v3 documentation (v3.0.0-beta.5)*
