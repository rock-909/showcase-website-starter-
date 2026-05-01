import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FORM_FIELD_REQUIRED_CLASS_NAME } from "@/components/forms/form-status-styles";

/**
 * Name fields component - React 19 Native Form Version
 * 使用原生HTML表单属性，配合Server Actions进行表单处理
 */
interface NameFieldsProps {
  /** 国际化翻译函数 */
  t: (_key: string) => string;
  /** 表单提交状态（来自useActionState的isPending） */
  isPending: boolean;
}

export function NameFields({ t, isPending }: NameFieldsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="firstName" className={FORM_FIELD_REQUIRED_CLASS_NAME}>
          {t("firstName")}
        </Label>
        <Input
          id="firstName"
          name="firstName"
          type="text"
          placeholder={t("firstNamePlaceholder")}
          disabled={isPending}
          required
          aria-describedby="firstName-error"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="lastName" className={FORM_FIELD_REQUIRED_CLASS_NAME}>
          {t("lastName")}
        </Label>
        <Input
          id="lastName"
          name="lastName"
          type="text"
          placeholder={t("lastNamePlaceholder")}
          disabled={isPending}
          required
          aria-describedby="lastName-error"
        />
      </div>
    </div>
  );
}
